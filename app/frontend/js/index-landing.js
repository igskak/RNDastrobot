document.addEventListener('DOMContentLoaded', () => {
    const previewCard = document.querySelector('[data-preview-card]');
    if (!previewCard) return;

    const tabs = Array.from(previewCard.querySelectorAll('[data-preview-tab]'));
    const panes = Array.from(previewCard.querySelectorAll('[data-preview-pane]'));
    if (!tabs.length || !panes.length) return;

    function setActivePreview(mode, shouldFocus = false) {
        tabs.forEach((tab) => {
            const isActive = tab.dataset.previewTab === mode;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            if (isActive && shouldFocus) tab.focus();
        });

        panes.forEach((pane) => {
            const isActive = pane.dataset.previewPane === mode;
            pane.classList.toggle('is-active', isActive);
            pane.hidden = !isActive;
        });
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => setActivePreview(tab.dataset.previewTab));
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

            event.preventDefault();
            const lastIndex = tabs.length - 1;
            let nextIndex = index;
            if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
            if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = lastIndex;

            setActivePreview(tabs[nextIndex].dataset.previewTab, true);
        });
    });
});
