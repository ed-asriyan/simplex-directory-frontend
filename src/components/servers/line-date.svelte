<script lang="ts">
    import { onMount } from 'svelte';
    import { readable, type Readable } from 'svelte/store';
    import moment from 'moment';
    import { convertUTCDateToLocalDate } from '../../utils';

    interface Props {
        date: string;
    }

    let { date }: Props = $props();

    let dateObj = $derived(new Date(date));

    const getMoment = function (): moment.Moment {
        return dateObj && moment(convertUTCDateToLocalDate(dateObj));
    };
 
    let display: Readable<moment.Moment> = $state();

    onMount(() => {
        display = readable<moment.Moment>(getMoment(), set => {
            const interval = setInterval(() => {
                dateObj && set(getMoment());
            }, 1000);

            return function stop() {
                clearInterval(interval);
            };
        });
    });
</script>

{#if $display}
    <span uk-tooltip={$display ? $display.format('YYYY-MM-DD hh-mm-ss') : ""}>
        {$display?.fromNow()}
    </span> 
{/if}
