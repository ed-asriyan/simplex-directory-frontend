import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Types for wx-svelte-filter
 */
interface FilterRule {
  field: string;
  filter: string;
  value: any;
  type?: 'text' | 'number' | 'date' | 'tuple';
  includes?: any[];
}

interface FilterGroup {
  glue: 'and' | 'or';
  rules: (FilterRule | FilterGroup)[];
}

export type FilterValue = FilterGroup | {};

/**
 * Helper to check if a rule is a group
 */
const isFilterGroup = function (rule: FilterRule | FilterGroup): rule is FilterGroup {
  return 'glue' in rule && 'rules' in rule;
};

/**
 * Format date values for Supabase
 * Converts JavaScript Date objects to ISO strings
 */
const formatValueForSupabase = function (value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(formatValueForSupabase);
  }
  return value;
}

/**
 * Escape and format value for PostgREST filter string
 */
const formatValueForFilter = function (value: any): string {
  const formatted = formatValueForSupabase(value);
  
  if (typeof formatted === 'string') {
    // For string values, we need to properly escape them
    return formatted.replace(/([,()\\])/g, '\\$1');
  }
  
  return JSON.stringify(formatted);
}

/**
 * Convert a single filter rule to PostgREST filter string
 */
const ruleToFilterString = function (rule: FilterRule): string {
  const { field, filter, value: rawValue, includes } = rule;
  const value = formatValueForSupabase(rawValue);

  // Handle includes (array of exact matches)
  if (includes && includes.length > 0) {
    const formattedIncludes = includes.map(v => formatValueForFilter(v)).join(',');
    return `${field}.in.(${formattedIncludes})`;
  }

  // Handle different filter operators
  switch (filter) {
    // Text filters
    case 'contains':
      return `${field}.ilike.*${formatValueForFilter(value)}*`;
    
    case 'notContains':
      return `${field}.not.ilike.*${formatValueForFilter(value)}*`;
    
    case 'equal':
      return `${field}.eq.${formatValueForFilter(value)}`;
    
    case 'notEqual':
      return `${field}.neq.${formatValueForFilter(value)}`;
    
    case 'beginsWith':
      return `${field}.ilike.${formatValueForFilter(value)}*`;
    
    case 'notBeginsWith':
      return `${field}.not.ilike.${formatValueForFilter(value)}*`;
    
    case 'endsWith':
      return `${field}.ilike.*${formatValueForFilter(value)}`;
    
    case 'notEndsWith':
      return `${field}.not.ilike.*${formatValueForFilter(value)}`;
    
    // Numeric and date filters
    case 'greater':
      return `${field}.gt.${formatValueForFilter(value)}`;
    
    case 'less':
      return `${field}.lt.${formatValueForFilter(value)}`;
    
    case 'greaterOrEqual':
      return `${field}.gte.${formatValueForFilter(value)}`;
    
    case 'lessOrEqual':
      return `${field}.lte.${formatValueForFilter(value)}`;
    
    // Date range filters
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return `and(${field}.gte.${formatValueForFilter(value[0])},${field}.lte.${formatValueForFilter(value[1])})`;
      }
      throw new Error(`Invalid value for 'between' filter: ${value}`);
    
    case 'notBetween':
      if (Array.isArray(value) && value.length === 2) {
        return `or(${field}.lt.${formatValueForFilter(value[0])},${field}.gt.${formatValueForFilter(value[1])})`;
      }
      throw new Error(`Invalid value for 'notBetween' filter: ${value}`);
    
    default:
      console.warn(`Unknown filter operator: ${filter}`);
      return '';
  }
}

/**
 * Convert a filter group to PostgREST filter string recursively
 * This handles arbitrary nesting depth
 */
const groupToFilterString = function (group: FilterGroup): string {
  const { glue, rules } = group;
  
  if (!rules || rules.length === 0) {
    return '';
  }

  const filterStrings: string[] = [];
  
  for (const rule of rules) {
    if (isFilterGroup(rule)) {
      const nestedFilter = groupToFilterString(rule);
      if (nestedFilter) {
        filterStrings.push(nestedFilter);
      }
    } else {
      const filterStr = ruleToFilterString(rule);
      if (filterStr) {
        filterStrings.push(filterStr);
      }
    }
  }
  
  if (filterStrings.length === 0) {
    return '';
  }
  
  if (filterStrings.length === 1) {
    return filterStrings[0];
  }
  
  // Combine with AND or OR
  return `${glue}(${filterStrings.join(',')})`;
}

/**
 * Apply filter string to Supabase query using the RPC approach for complex filters
 */
const applyComplexFilter = function <T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  filterString: string
): T {
  if (!filterString) {
    return query;
  }
  
  // Use the or() method with the complete filter string
  // This allows PostgREST to parse complex nested conditions
  return query.or(filterString) as T;
}

/**
 * Apply simple filters directly (optimized path for simple AND conditions)
 */
const applySimpleFilters = function <T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  group: FilterGroup
): T {
  // Only use this path for simple AND operations with no nesting
  if (group.glue !== 'and') {
    return query;
  }
  
  for (const rule of group.rules) {
    if (isFilterGroup(rule)) {
      // Has nesting, can't use simple path
      return query;
    }
  }
  
  // Apply each rule directly
  for (const rule of group.rules) {
    const { field, filter, value: rawValue, includes } = rule as FilterRule;
    const value = formatValueForSupabase(rawValue);
    
    if (includes && includes.length > 0) {
      query = query.in(field, includes.map(formatValueForSupabase)) as T;
      continue;
    }
    
    switch (filter) {
      case 'contains':
        query = query.ilike(field, `%${value}%`) as T;
        break;
      case 'notContains':
        query = query.not(field, 'ilike', `%${value}%`) as T;
        break;
      case 'equal':
        query = query.eq(field, value) as T;
        break;
      case 'notEqual':
        query = query.neq(field, value) as T;
        break;
      case 'beginsWith':
        query = query.ilike(field, `${value}%`) as T;
        break;
      case 'notBeginsWith':
        query = query.not(field, 'ilike', `${value}%`) as T;
        break;
      case 'endsWith':
        query = query.ilike(field, `%${value}`) as T;
        break;
      case 'notEndsWith':
        query = query.not(field, 'ilike', `%${value}`) as T;
        break;
      case 'greater':
        query = query.gt(field, value) as T;
        break;
      case 'less':
        query = query.lt(field, value) as T;
        break;
      case 'greaterOrEqual':
        query = query.gte(field, value) as T;
        break;
      case 'lessOrEqual':
        query = query.lte(field, value) as T;
        break;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          query = query.gte(field, value[0]).lte(field, value[1]) as T;
        }
        break;
      case 'notBetween':
        if (Array.isArray(value) && value.length === 2) {
          query = query.or(`${field}.lt.${formatValueForFilter(value[0])},${field}.gt.${formatValueForFilter(value[1])}`) as T;
        }
        break;
    }
  }
  
  return query;
};

/**
 * Check if a filter group is simple (no nesting, only AND)
 */
const isSimpleAndGroup = function (group: FilterGroup): boolean {
  if (group.glue !== 'and') {
    return false;
  }
  
  for (const rule of group.rules) {
    if (isFilterGroup(rule)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Main function to apply wx-svelte-filter to Supabase query
 * 
 * @param query - Supabase query builder object
 * @param filterValue - wx-svelte-filter value object
 * @returns Modified Supabase query with filters applied
 * 
 * @example
 * ```typescript
 * import { createClient } from '@supabase/supabase-js';
 * import { applyFiltersToSupabase } from './supabase-filter-adapter';
 * 
 * const supabase = createClient('url', 'key');
 * 
 * // Simple filter
 * const simpleFilter = {
 *   glue: 'and',
 *   rules: [
 *     { field: 'name', filter: 'contains', value: 'John' },
 *     { field: 'age', filter: 'greater', value: 25 }
 *   ]
 * };
 * 
 * // Complex nested filter
 * const complexFilter = {
 *   glue: 'and',
 *   rules: [
 *     {
 *       glue: 'or',
 *       rules: [
 *         { field: 'status', filter: 'equal', value: 'active' },
 *         {
 *           glue: 'and',
 *           rules: [
 *             { field: 'role', filter: 'equal', value: 'admin' },
 *             { field: 'verified', filter: 'equal', value: true }
 *           ]
 *         }
 *       ]
 *     },
 *     { field: 'country', filter: 'equal', value: 'USA' }
 *   ]
 * };
 * 
 * let query = supabase.from('users').select('*');
 * query = applyFiltersToSupabase(query, complexFilter);
 * 
 * const { data, error } = await query;
 * ```
 */
export const applyFiltersToSupabase =function <T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  filterValue: FilterValue | null | undefined
): T {
  // If no filter value provided, return query as-is
  if (!filterValue || !filterValue.rules || filterValue.rules.length === 0) {
    return query;
  }

  // For simple AND-only filters with no nesting, use the optimized path
  if (isSimpleAndGroup(filterValue)) {
    return applySimpleFilters(query, filterValue);
  }
  
  // For complex filters with nesting or OR conditions, build filter string
  const filterString = groupToFilterString(filterValue);
  
  if (!filterString) {
    return query;
  }
  
  // Special handling for top-level AND groups
  if (filterValue.glue === 'and' && !filterValue.rules.some(isFilterGroup)) {
    // If it's a simple AND at the top level, we can apply filters directly
    return applySimpleFilters(query, filterValue);
  }
  
  // For complex nested structures, we need to use the filter string approach
  // If the top level is AND, we need to wrap the conditions properly
  if (filterValue.glue === 'and') {
    // Extract the conditions from the and() wrapper
    const conditions = filterString.replace(/^and\((.*)\)$/, '$1');
    
    // Apply each top-level condition
    const topLevelConditions = [];
    let depth = 0;
    let currentCondition = '';
    
    for (let i = 0; i < conditions.length; i++) {
      const char = conditions[i];
      
      if (char === '(') depth++;
      else if (char === ')') depth--;
      
      if (char === ',' && depth === 0) {
        topLevelConditions.push(currentCondition);
        currentCondition = '';
      } else {
        currentCondition += char;
      }
    }
    
    if (currentCondition) {
      topLevelConditions.push(currentCondition);
    }
    
    // Apply each condition separately for AND logic
    for (const condition of topLevelConditions) {
      query = query.or(condition) as T;
    }
    
    return query;
  }
  
  // For OR at the top level, apply the entire filter string
  return applyComplexFilter(query, filterString);
}

/**
 * Alternative function name for convenience
 */
export const applyFilters = applyFiltersToSupabase;

/**
 * Export types for external use
 */
export type { FilterRule, FilterGroup, FilterValue };
