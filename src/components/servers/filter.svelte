<!-- <script lang="ts">
    import { sort } from 'd3';
    import { delay } from '../../utils';
    import { processSql, renderHttp, formatCurl, renderSupabaseJs, type Filter, type Sort} from '@supabase/sql-to-rest';


    interface Props {
    sorts: Sort[] | undefined;
    filter: Filter | undefined;
    }

    let { sorts = $bindable([]), filter = $bindable(undefined) }: Props = $props();

    let value: string = $state('');
    let error: string | undefined = $state('');

    const prefix = "SELECT * FROM servers WHERE ";

    const onKeyUp = async function () {
        if (!value) {
            error = undefined;
        }
        try {
            ({ sorts, filter } = await processSql(prefix + value));
        } catch (e) {
            error = e?.message || 'Unknown error';
        }
    };
</script>

<div uk-grid>
    <div class="uk-width-auto">
      <code class="uk-text-large uk-margin-small-right">{prefix}</code>
    </div>
    <div class="uk-width-expand uk-padding-remove-left">
      <input class="uk-input" class:uk-input-danger={error} type="text" bind:value={value} onkeyup={delay(onKeyUp, 1500)} placeholder="WHERE ..." />
      {#if error}
        <div class="uk-text-danger">{error}</div>
      {/if}
    </div>
</div> -->

<script lang="ts">
    import { FilterBuilder, Willow } from '@svar-ui/svelte-filter';
    import type { FilterValue } from '../../store/supabase-filter-converter';

    interface Props {
        filters: FilterValue;
        countries: readonly string[];
    }

    let { filters = $bindable({}), countries }: Props = $props();

    const fields = [
        { id: "age", label: "Age", type: "number" },
        { id: "host", label: "Host", type: "text" },
        { id: "protocol", label: "Protocol", type: "select" },
        { id: "country", label: "Country", type: "select" },
        { id: "label", label: "Label", type: "select" },
        { id: "identity", label: "Identity", type: "text" },
        { id: "infoPageAvailable", label: "Info Page Available", type: "select" },
        { id: "status", label: "Is Online", type: "select" },
        { id: "lastCheck", label: "Last Check", type: "date" },
        { id: "uptime7", label: "Uptime 7d", type: "number" },
        { id: "uptime30", label: "Uptime 30d", type: "number" },
        { id: "uptime90", label: "Uptime 90d", type: "number" },
    ];

    const options = $derived({
        age: [24, 26, 33, 35, 44, 45, 62],
        protocol: ["SMP", "XFTP"],
        label: ["added", "ignored"],
        country: countries,
        infoPageAvailable: [true, false],
        status: [true, false],
    });

    function onChange({ value }: { value: FilterValue }) {
        filters = normalizeFilters(value);
    };

    const normalizeFilters = (filters: FilterValue): FilterValue => {
        // Normalize the filters as needed
        return filters;
    };
</script>

<Willow>
  <FilterBuilder {fields} {options} value={filters} type="line" onchange={onChange}/>
</Willow>

<!-- <pre>{JSON.stringify(filters, null, 2)}</pre> -->