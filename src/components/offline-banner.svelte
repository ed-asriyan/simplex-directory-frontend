<script lang="ts">
    import { onMount } from 'svelte';
    import Modal from './modal.svelte';
    import { url } from '../settings';

    // The URL used for periodic connectivity probes.
    // We prefer the configured app URL so we can detect site-level blocks;
    // fall back to the current origin when VITE_URL is not set.
    const probeBase = (url || window.location.origin).replace(/\/$/, '');

    let offline = $state(false);
    let modalOpen = $state(false);

    async function checkConnectivity() {
        try {
            // Use a timestamp query param to prevent the service worker from
            // returning a cached response – we need a real network round-trip.
            // Use GET (not HEAD) for maximum server/CDN compatibility.
            await fetch(`${probeBase}/robots.txt?_probe=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                signal: AbortSignal.timeout(8000),
            });
            offline = false;
        } catch {
            offline = true;
        }
    }

    onMount(() => {
        offline = !navigator.onLine;

        const handleOnline = () => { offline = false; };
        const handleOffline = () => { offline = true; };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Periodically probe the main domain to catch site-level blocks.
        const intervalId = setInterval(checkConnectivity, 30_000);

        // Run an immediate probe so we don't rely solely on navigator.onLine.
        checkConnectivity();

        // Cleanup: remove event listeners and clear the interval on destroy.
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(intervalId);
        };
    });
</script>

{#if offline}
    <button class="offline-banner" onclick={() => (modalOpen = true)}>
        <span>⚠️</span>
        <span class="offline-banner__text">
            No internet connection or the site is blocked — tap for help
        </span>
        <span class="offline-banner__cta">What to do →</span>
    </button>
{/if}

<Modal bind:open={modalOpen} width="32em">
    <div class="offline-modal">
        <h3 class="offline-modal__title">🔴 Site unavailable</h3>

        <p>
            The site cannot be reached. This may be caused by a lack of internet connection or
            because your ISP or regional network authority (e.g. Roskomnadzor) has blocked access
            to this page.
        </p>

        <h4>Fix it with FlyDify</h4>
        <ol>
            <li>Open the <strong>FlyDify</strong> app on your device.</li>
            <li>Go to <strong>Settings</strong>.</li>
            <li>Tap <strong>Routing</strong>.</li>
            <li>
                Set the region to <strong>Other</strong> (or any region outside your country).
            </li>
            <li>Reconnect and reload this page.</li>
        </ol>

        <p class="offline-modal__hint">
            Don't have FlyDify? Any VPN that lets you choose a server outside your country will
            work.
        </p>

        <button
            class="uk-button uk-button-primary offline-modal__reload"
            onclick={() => {
                modalOpen = false;
                window.location.reload();
            }}
        >
            Retry connection
        </button>
    </div>
</Modal>

<style lang="scss">
    .offline-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 9999;

        display: flex;
        align-items: center;
        gap: 0.5rem;

        padding: 0.75rem 1.25rem;
        background: #d32f2f;
        color: #fff;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        user-select: none;

        /* Reset default <button> appearance */
        border: none;
        border-radius: 0;
        text-align: left;
        font-family: inherit;
        width: 100%;

        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.35);

        &:hover {
            background: #b71c1c;
        }

        &__text {
            flex: 1;
        }

        &__cta {
            white-space: nowrap;
            font-weight: 700;
            text-decoration: underline;
        }
    }

    .offline-modal {
        padding: 0.5rem 0.25rem;

        &__title {
            margin-top: 0;
        }

        ol {
            padding-left: 1.25rem;
            li {
                margin-bottom: 0.35rem;
            }
        }

        &__hint {
            font-size: 0.85rem;
            color: #777;
            margin-top: 1rem;
        }

        &__reload {
            margin-top: 1rem;
            width: 100%;
        }
    }
</style>
