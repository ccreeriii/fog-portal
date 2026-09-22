(function initializePremiumJournalUi(root, factory) {
    const api = factory(root);

    if (
        typeof module === 'object' &&
        module &&
        module.exports
    ) {
        module.exports = api;
    }

    if (root && typeof root === 'object') {
        root.FOGJournalPremiumUI = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function premiumJournalUiFactory(root) {
        'use strict';

        const PAGE_SIZE = 10;

        const state = {
            installed: false,
            view: 'list',
            query: '',
            mood: 'all',
            page: 1,
            expandedId: null,
            calendarYear: null,
            calendarMonth: null,
            calendarSelectedDate: null
        };

        function doc() {
            if (
                !root ||
                !root.document
            ) {
                return null;
            }

            return root.document;
        }

        function text(
            parent,
            tag,
            value,
            className
        ) {
            const document = doc();

            if (!document) {
                return null;
            }

            const element =
                document.createElement(tag);

            if (className) {
                element.className =
                    className;
            }

            element.textContent =
                value == null
                    ? ''
                    : String(value);

            if (parent) {
                parent.appendChild(
                    element
                );
            }

            return element;
        }

        function button(
            label,
            className,
            handler
        ) {
            const document = doc();

            const element =
                document.createElement(
                    'button'
                );

            element.type =
                'button';

            element.textContent =
                label;

            if (className) {
                element.className =
                    className;
            }

            if (
                typeof handler ===
                    'function'
            ) {
                element.addEventListener(
                    'click',
                    handler
                );
            }

            return element;
        }

        function normalize(value) {
            return String(
                value || ''
            )
                .toLocaleLowerCase()
                .trim();
        }

        function entryDateKey(entry) {
            const raw =
                String(
                    entry &&
                    entry.created_at ||
                    ''
                ).trim();

            const match =
                raw.match(
                    /^(\d{4}-\d{2}-\d{2})/
                );

            if (match) {
                return match[1];
            }

            const date =
                new Date(raw);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return '';
            }

            return [
                date
                    .getFullYear()
                    .toString()
                    .padStart(4, '0'),
                String(
                    date.getMonth() + 1
                ).padStart(2, '0'),
                String(
                    date.getDate()
                ).padStart(2, '0')
            ].join('-');
        }

        function readableDate(entry) {
            const key =
                entryDateKey(entry);

            if (!key) {
                return '';
            }

            const [
                year,
                month,
                day
            ] =
                key
                    .split('-')
                    .map(Number);

            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );

            return new Intl.DateTimeFormat(
                undefined,
                {
                    month:
                        'short',
                    day:
                        'numeric',
                    year:
                        'numeric'
                }
            ).format(date);
        }

        function shortMonth(entry) {
            const key =
                entryDateKey(entry);

            if (!key) {
                return {
                    month: '',
                    day: ''
                };
            }

            const [
                year,
                month,
                day
            ] =
                key
                    .split('-')
                    .map(Number);

            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );

            return {
                month:
                    new Intl
                        .DateTimeFormat(
                            undefined,
                            {
                                month:
                                    'short'
                            }
                        )
                        .format(date)
                        .toUpperCase(),
                day:
                    String(day)
            };
        }

        function previewText(
            value,
            limit = 180
        ) {
            const raw =
                String(
                    value || ''
                ).trim();

            if (
                raw.length <= limit
            ) {
                return raw;
            }

            return (
                raw
                    .slice(
                        0,
                        limit
                    )
                    .trimEnd() +
                '…'
            );
        }

        function filterEntries(
            entries,
            query,
            mood
        ) {
            const needle =
                normalize(query);

            return (
                Array.isArray(entries)
                    ? entries
                    : []
            ).filter(
                entry => {
                    if (
                        mood &&
                        mood !== 'all' &&
                        String(
                            entry.mood || ''
                        ) !== mood
                    ) {
                        return false;
                    }

                    if (!needle) {
                        return true;
                    }

                    /*
                     * This search happens ONLY against
                     * decrypted entries already in browser
                     * memory. Nothing is sent to the server.
                     */
                    const haystack = [
                        entry.title,
                        entry.mood,
                        entry.content
                    ]
                        .map(normalize)
                        .join('\n');

                    return haystack
                        .includes(
                            needle
                        );
                }
            );
        }

        function uniqueMoods(
            entries
        ) {
            return Array
                .from(
                    new Set(
                        (
                            Array.isArray(
                                entries
                            )
                                ? entries
                                : []
                        )
                            .map(
                                item =>
                                    String(
                                        item.mood ||
                                        ''
                                    ).trim()
                            )
                            .filter(Boolean)
                    )
                )
                .sort(
                    (a, b) =>
                        a.localeCompare(b)
                );
        }

        function openWriter() {
            const document =
                doc();

            const tab =
                document &&
                document
                    .getElementById(
                        'newJournalTabButton'
                    );

            if (tab) {
                tab.click();

                const title =
                    document
                        .getElementById(
                            'journalTitle'
                        );

                if (
                    title &&
                    typeof title.focus ===
                        'function'
                ) {
                    root.setTimeout(
                        () =>
                            title.focus(),
                        50
                    );
                }
            }
        }

        function openJournalList() {
            const document =
                doc();

            const tab =
                document &&
                document
                    .getElementById(
                        'myJournalTabButton'
                    );

            if (tab) {
                tab.click();
            }
        }

        function experienceMode() {
            const secure =
                root &&
                root
                    .FOGJournalSecureController;

            if (
                secure &&
                typeof secure
                    .getExperienceMode ===
                    'function'
            ) {
                return secure
                    .getExperienceMode();
            }

            return 'private_journal';
        }


        function enhanceShell() {
            const document =
                doc();

            if (!document) {
                return false;
            }

            const shell =
                document.querySelector(
                    '.journal-feature-shell'
                );

            if (!shell) {
                return false;
            }

            shell.classList.add(
                'journal-premium-shell'
            );

            const youthMode =
                experienceMode() ===
                'youth_reflection';

            shell.classList.toggle(
                'journal-youth-reflection',
                youthMode
            );

            const intro =
                shell.querySelector(
                    '#journalFeatureIntro'
                );

            if (intro) {
                intro.classList.remove(
                    'journal-premium-intro'
                );
            }

            const tabs =
                shell.querySelector(
                    '.feature-tabs'
                );

            if (tabs) {
                tabs.classList.add(
                    'journal-premium-tabs'
                );
            }

            const journalTab =
                document.getElementById(
                    'myJournalTabButton'
                );

            if (journalTab) {
                journalTab.textContent =
                    youthMode
                        ? 'Reflections'
                        : 'Journal';
            }

            const writeTab =
                document.getElementById(
                    'newJournalTabButton'
                );

            if (writeTab) {
                writeTab.textContent =
                    youthMode
                        ? 'Reflect'
                        : 'Write';
            }

            const form =
                document.getElementById(
                    'journalForm'
                );

            if (form) {
                form.classList.add(
                    'journal-premium-composer'
                );

                const previousGuidance =
                    form.querySelector(
                        '.journal-youth-guidance'
                    );

                if (
                    youthMode &&
                    !previousGuidance
                ) {
                    const guidance =
                        document.createElement(
                            'section'
                        );

                    guidance.className =
                        'journal-youth-guidance';

                    guidance.setAttribute(
                        'aria-label',
                        'YOUTH REFLECTION — A safe place to pause and pray.'
                    );

                    const guidanceTitle =
                        document.createElement(
                            'strong'
                        );

                    guidanceTitle.textContent =
                        'Need a place to begin?';

                    const guidanceCopy =
                        document.createElement(
                            'p'
                        );

                    guidanceCopy.textContent =
                        'You can write about something you are thankful for, something you learned today, someone you want to pray for, or a moment you want to remember.';

                    guidance.append(
                        guidanceTitle,
                        guidanceCopy
                    );

                    form.prepend(
                        guidance
                    );

                } else if (
                    !youthMode &&
                    previousGuidance
                ) {
                    previousGuidance.remove();
                }

                const titleInput =
                    document
                        .getElementById(
                            'journalTitle'
                        );

                if (titleInput) {
                    titleInput.placeholder =
                        youthMode
                            ? 'What would you like to remember?'
                            : 'Give this reflection a short title';
                }

                const contentInput =
                    document
                        .getElementById(
                            'journalContent'
                        );

                if (contentInput) {
                    contentInput.placeholder =
                        youthMode
                            ? 'What made you thankful? What did you learn? What would you like to pray about?'
                            : 'What is on your heart today?';
                }

                if (
                    !form.querySelector(
                        '.journal-premium-composer__note'
                    )
                ) {
                    const note =
                        text(
                            null,
                            'p',
                            'Your words are encrypted on this device before saving.',
                            'journal-premium-composer__note'
                        );

                    form.prepend(note);
                }
            }

            return true;
        }

        function createMoodChip(
            mood
        ) {
            if (!mood) {
                return null;
            }

            return text(
                null,
                'span',
                mood,
                'journal-premium-mood'
            );
        }

        function createActionsMenu(
            entry
        ) {
            const document =
                doc();

            const details =
                document.createElement(
                    'details'
                );

            details.className =
                'journal-premium-actions';

            const summary =
                document.createElement(
                    'summary'
                );

            summary.textContent =
                '•••';

            summary.setAttribute(
                'aria-label',
                'Reflection actions'
            );

            details.appendChild(
                summary
            );

            const menu =
                document.createElement(
                    'div'
                );

            menu.className =
                'journal-premium-actions__menu';

            const edit =
                button(
                    'Edit',
                    '',
                    () => {
                        details.open =
                            false;

                        if (
                            root
                                .V2Discipleship &&
                            typeof root
                                .V2Discipleship
                                .openEditJournalModal ===
                                'function'
                        ) {
                            root
                                .V2Discipleship
                                .openEditJournalModal(
                                    entry.id
                                );
                        }
                    }
                );

            const remove =
                button(
                    'Delete',
                    'is-danger',
                    () => {
                        details.open =
                            false;

                        if (
                            root
                                .V2Discipleship &&
                            typeof root
                                .V2Discipleship
                                .deleteJournal ===
                                'function'
                        ) {
                            root
                                .V2Discipleship
                                .deleteJournal(
                                    entry.id
                                );
                        }
                    }
                );

            menu.append(
                edit,
                remove
            );

            details.appendChild(
                menu
            );

            return details;
        }

        function showReflection(
            entry
        ) {
            const document =
                doc();

            const overlay =
                document.createElement(
                    'div'
                );

            overlay.className =
                'journal-family-overlay';

            const dialog =
                document.createElement(
                    'section'
                );

            dialog.className =
                'journal-family-dialog journal-premium-reader';

            dialog.setAttribute(
                'role',
                'dialog'
            );
            dialog.setAttribute(
                'aria-modal',
                'true'
            );

            text(
                dialog,
                'p',
                readableDate(entry),
                'journal-premium-entry__meta'
            );

            const title =
                text(
                    dialog,
                    'h2',
                    entry.title ||
                        'Untitled reflection',
                    'journal-family-dialog__title'
                );

            title.id =
                'journalReflectionReaderTitle';

            dialog.setAttribute(
                'aria-labelledby',
                title.id
            );

            const mood =
                createMoodChip(
                    entry.mood
                );

            if (mood) {
                dialog.appendChild(
                    mood
                );
            }

            text(
                dialog,
                'p',
                String(
                    entry.content ||
                    ''
                ),
                'journal-premium-reader__content'
            );

            const close =
                button(
                    'Close',
                    'journal-premium-primary',
                    () => overlay.remove()
                );

            dialog.appendChild(close);
            overlay.appendChild(dialog);
            document.body.appendChild(
                overlay
            );
            close.focus();
        }

        function createListEntry(
            entry
        ) {
            const document =
                doc();

            const article =
                document.createElement(
                    'article'
                );

            article.className =
                'journal-premium-entry journal-premium-entry--list';

            const date =
                shortMonth(entry);

            const dateBox =
                document.createElement(
                    'div'
                );

            dateBox.className =
                'journal-premium-date';

            text(
                dateBox,
                'span',
                date.month,
                'journal-premium-date__month'
            );

            text(
                dateBox,
                'strong',
                date.day,
                'journal-premium-date__day'
            );

            const main =
                document.createElement(
                    'div'
                );

            main.className =
                'journal-premium-entry__main';

            const headingRow =
                document.createElement(
                    'div'
                );

            headingRow.className =
                'journal-premium-entry__heading';

            text(
                headingRow,
                'h3',
                entry.title ||
                    'Untitled reflection',
                'journal-premium-entry__title'
            );

            const mood =
                createMoodChip(
                    entry.mood
                );

            if (mood) {
                headingRow.appendChild(
                    mood
                );
            }

            main.appendChild(
                headingRow
            );

            const controls =
                document.createElement(
                    'div'
                );

            controls.className =
                'journal-premium-entry__controls';

            controls.appendChild(
                button(
                    'Open',
                    'journal-premium-open',
                    () =>
                        showReflection(
                            entry
                        )
                )
            );

            controls.appendChild(
                createActionsMenu(
                    entry
                )
            );

            article.append(
                dateBox,
                main,
                controls
            );

            return article;
        }

        function createGridEntry(
            entry
        ) {
            const document =
                doc();

            const article =
                document.createElement(
                    'article'
                );

            article.className =
                'journal-premium-entry journal-premium-entry--grid';

            const top =
                document.createElement(
                    'div'
                );

            top.className =
                'journal-premium-grid__top';

            const date =
                shortMonth(entry);

            const dateBox =
                document.createElement(
                    'div'
                );

            dateBox.className =
                'journal-premium-date journal-premium-date--grid';

            text(
                dateBox,
                'span',
                date.month,
                'journal-premium-date__month'
            );

            text(
                dateBox,
                'strong',
                date.day,
                'journal-premium-date__day'
            );

            top.appendChild(
                dateBox
            );

            top.appendChild(
                createActionsMenu(
                    entry
                )
            );

            article.appendChild(
                top
            );

            text(
                article,
                'h3',
                entry.title ||
                    'Untitled reflection',
                'journal-premium-entry__title'
            );

            const mood =
                createMoodChip(
                    entry.mood
                );

            if (mood) {
                article.appendChild(
                    mood
                );
            }

            const content =
                String(
                    entry.content ||
                    ''
                );

            text(
                article,
                'p',
                previewText(
                    content,
                    180
                ),
                'journal-premium-entry__preview'
            );

            if (content.trim()) {
                article.appendChild(
                    button(
                        'Read reflection',
                        'journal-premium-open',
                        () =>
                            showReflection(
                                entry
                            )
                    )
                );
            }

            return article;
        }

        function getEntries() {
            const entries =
                root &&
                root.V2Discipleship &&
                root
                    .V2Discipleship
                    .journalsData;

            return Array.isArray(
                entries
            )
                ? entries
                : [];
        }

        function renderEmptyState(
            parent,
            filtered
        ) {
            const box =
                doc()
                    .createElement(
                        'section'
                    );

            box.className =
                'journal-premium-empty';

            text(
                box,
                'div',
                '✦',
                'journal-premium-empty__mark'
            );

            text(
                box,
                'h3',
                filtered
                    ? 'No reflections match this view.'
                    : 'Your journal begins with one quiet moment.',
                'journal-premium-empty__title'
            );

            text(
                box,
                'p',
                filtered
                    ? 'Try another search or mood filter.'
                    : 'Take a moment with God when you are ready. Your reflections will appear here.',
                'journal-premium-empty__copy'
            );

            if (!filtered) {
                box.appendChild(
                    button(
                        'Write a Reflection',
                        'journal-premium-primary',
                        openWriter
                    )
                );
            }

            parent.appendChild(
                box
            );
        }

        function createViewSwitcher() {
            const wrap =
                doc()
                    .createElement(
                        'div'
                    );

            wrap.className =
                'journal-premium-view-switch';

            wrap.setAttribute(
                'aria-label',
                'Journal view'
            );

            for (
                const [
                    mode,
                    label
                ] of [
                    [
                        'list',
                        'List'
                    ],
                    [
                        'grid',
                        'Grid'
                    ],
                    [
                        'calendar',
                        'Calendar'
                    ]
                ]
            ) {
                const control =
                    button(
                        label,
                        state.view ===
                            mode
                            ? 'is-active'
                            : '',
                        () => {
                            state.view =
                                mode;

                            state.page =
                                1;

                            state.expandedId =
                                null;

                            renderCurrent();
                        }
                    );

                control.setAttribute(
                    'aria-pressed',
                    state.view ===
                        mode
                        ? 'true'
                        : 'false'
                );

                wrap.appendChild(
                    control
                );
            }

            return wrap;
        }

        function createToolbar(
            entries,
            visibleEntries
        ) {
            const document =
                doc();

            const toolbar =
                document.createElement(
                    'section'
                );

            toolbar.className =
                'journal-premium-toolbar';

            const top =
                document.createElement(
                    'div'
                );

            top.className =
                'journal-premium-toolbar__top';

            const summary =
                document.createElement(
                    'div'
                );

            text(
                summary,
                'h3',
                'My Reflections',
                'journal-premium-toolbar__title'
            );

            text(
                summary,
                'p',
                `${visibleEntries.length} ${
                    visibleEntries.length ===
                    1
                        ? 'reflection'
                        : 'reflections'
                }`,
                'journal-premium-toolbar__count'
            );

            const topActions =
                document.createElement(
                    'div'
                );

            topActions.className =
                'journal-premium-toolbar__actions';

            topActions.append(
                createViewSwitcher(),
                button(
                    '+ New Reflection',
                    'journal-premium-primary',
                    openWriter
                )
            );

            top.append(
                summary,
                topActions
            );

            toolbar.appendChild(
                top
            );

            const filters =
                document.createElement(
                    'div'
                );

            filters.className =
                'journal-premium-filters';

            const search =
                document.createElement(
                    'input'
                );

            search.type =
                'search';

            search.value =
                state.query;

            search.placeholder =
                'Search your reflections';

            search.autocomplete =
                'off';

            search.className =
                'journal-premium-search';

            search.setAttribute(
                'aria-label',
                'Search reflections on this device'
            );

            search.addEventListener(
                'input',
                () => {
                    state.query =
                        search.value;

                    state.page =
                        1;

                    renderCurrent({
                        focusSearch:
                            true,
                        caret:
                            search.selectionStart
                    });
                }
            );

            const mood =
                document.createElement(
                    'select'
                );

            mood.className =
                'journal-premium-mood-filter';

            mood.setAttribute(
                'aria-label',
                'Filter reflections by mood'
            );

            const all =
                document.createElement(
                    'option'
                );

            all.value =
                'all';

            all.textContent =
                'All moods';

            mood.appendChild(
                all
            );

            for (
                const value of
                uniqueMoods(entries)
            ) {
                const option =
                    document
                        .createElement(
                            'option'
                        );

                option.value =
                    value;

                option.textContent =
                    value;

                mood.appendChild(
                    option
                );
            }

            mood.value =
                state.mood;

            mood.addEventListener(
                'change',
                () => {
                    state.mood =
                        mood.value;

                    state.page =
                        1;

                    renderCurrent();
                }
            );

            const searchWrap =
                document.createElement(
                    'div'
                );

            searchWrap.className =
                'journal-premium-search-wrap';

            searchWrap.appendChild(
                search
            );

            filters.append(
                searchWrap,
                mood
            );

            toolbar.appendChild(
                filters
            );

            return toolbar;
        }

        function dateKeyFromParts(
            year,
            month,
            day
        ) {
            return [
                String(year)
                    .padStart(
                        4,
                        '0'
                    ),
                String(month + 1)
                    .padStart(
                        2,
                        '0'
                    ),
                String(day)
                    .padStart(
                        2,
                        '0'
                    )
            ].join('-');
        }

        function calendarCells(
            year,
            month
        ) {
            const first =
                new Date(
                    year,
                    month,
                    1
                );

            const start =
                new Date(
                    year,
                    month,
                    1 -
                    first.getDay()
                );

            return Array.from(
                {
                    length: 42
                },
                (_, index) => {
                    const date =
                        new Date(
                            start
                        );

                    date.setDate(
                        start.getDate() +
                        index
                    );

                    return {
                        year:
                            date
                                .getFullYear(),
                        month:
                            date
                                .getMonth(),
                        day:
                            date
                                .getDate(),
                        currentMonth:
                            date
                                .getMonth() ===
                                month,
                        key:
                            dateKeyFromParts(
                                date
                                    .getFullYear(),
                                date
                                    .getMonth(),
                                date
                                    .getDate()
                            )
                    };
                }
            );
        }

        function ensureCalendarCursor(
            entries
        ) {
            if (
                Number.isInteger(
                    state.calendarYear
                ) &&
                Number.isInteger(
                    state.calendarMonth
                )
            ) {
                return;
            }

            const latest =
                (
                    Array.isArray(
                        entries
                    )
                        ? entries
                        : []
                )
                    .map(
                        entry =>
                            entryDateKey(
                                entry
                            )
                    )
                    .find(Boolean);

            if (latest) {
                const parts =
                    latest
                        .split('-')
                        .map(Number);

                state.calendarYear =
                    parts[0];

                state.calendarMonth =
                    parts[1] - 1;

                return;
            }

            const now =
                new Date();

            state.calendarYear =
                now.getFullYear();

            state.calendarMonth =
                now.getMonth();
        }

        function renderCalendar(
            parent,
            entries
        ) {
            const document =
                doc();

            ensureCalendarCursor(
                entries
            );

            const shell =
                document
                    .createElement(
                        'section'
                    );

            shell.className =
                'journal-premium-calendar';

            const header =
                document
                    .createElement(
                        'div'
                    );

            header.className =
                'journal-premium-calendar__header';

            const previous =
                button(
                    '‹',
                    'journal-premium-calendar__nav',
                    () => {
                        state.calendarMonth -=
                            1;

                        if (
                            state.calendarMonth <
                            0
                        ) {
                            state.calendarMonth =
                                11;

                            state.calendarYear -=
                                1;
                        }

                        state.calendarSelectedDate =
                            null;

                        renderCurrent();
                    }
                );

            previous.setAttribute(
                'aria-label',
                'Previous month'
            );

            const monthTitle =
                new Intl
                    .DateTimeFormat(
                        undefined,
                        {
                            month:
                                'long',
                            year:
                                'numeric'
                        }
                    )
                    .format(
                        new Date(
                            state.calendarYear,
                            state.calendarMonth,
                            1
                        )
                    );

            text(
                header,
                'h3',
                monthTitle,
                'journal-premium-calendar__title'
            );

            const next =
                button(
                    '›',
                    'journal-premium-calendar__nav',
                    () => {
                        state.calendarMonth +=
                            1;

                        if (
                            state.calendarMonth >
                            11
                        ) {
                            state.calendarMonth =
                                0;

                            state.calendarYear +=
                                1;
                        }

                        state.calendarSelectedDate =
                            null;

                        renderCurrent();
                    }
                );

            next.setAttribute(
                'aria-label',
                'Next month'
            );

            header.prepend(
                previous
            );

            header.appendChild(
                next
            );

            shell.appendChild(
                header
            );

            const weekdays =
                document
                    .createElement(
                        'div'
                    );

            weekdays.className =
                'journal-premium-calendar__weekdays';

            for (
                const day of [
                    'Sun',
                    'Mon',
                    'Tue',
                    'Wed',
                    'Thu',
                    'Fri',
                    'Sat'
                ]
            ) {
                text(
                    weekdays,
                    'span',
                    day
                );
            }

            shell.appendChild(
                weekdays
            );

            const grid =
                document
                    .createElement(
                        'div'
                    );

            grid.className =
                'journal-premium-calendar__grid';

            const counts =
                new Map();

            for (
                const entry of entries
            ) {
                const key =
                    entryDateKey(
                        entry
                    );

                if (!key) {
                    continue;
                }

                counts.set(
                    key,
                    (
                        counts.get(
                            key
                        ) ||
                        0
                    ) +
                    1
                );
            }

            for (
                const cell of
                calendarCells(
                    state.calendarYear,
                    state.calendarMonth
                )
            ) {
                const count =
                    counts.get(
                        cell.key
                    ) ||
                    0;

                const day =
                    button(
                        String(
                            cell.day
                        ),
                        [
                            'journal-premium-calendar__day',
                            cell.currentMonth
                                ? ''
                                : 'is-outside',
                            count
                                ? 'has-entry'
                                : '',
                            state
                                .calendarSelectedDate ===
                                cell.key
                                ? 'is-selected'
                                : ''
                        ]
                            .filter(
                                Boolean
                            )
                            .join(
                                ' '
                            ),
                        () => {
                            state.calendarSelectedDate =
                                cell.key;

                            renderCurrent();
                        }
                    );

                day.setAttribute(
                    'aria-label',
                    `${cell.key}${
                        count
                            ? `, ${count} ${
                                count ===
                                1
                                    ? 'reflection'
                                    : 'reflections'
                            }`
                            : ''
                    }`
                );

                /*
                 * Calendar cells intentionally contain
                 * only the day number and a small count
                 * indicator. Journal words never appear
                 * inside calendar cells.
                 */
                if (count) {
                    text(
                        day,
                        'span',
                        count > 9
                            ? '9+'
                            : String(
                                count
                            ),
                        'journal-premium-calendar__count'
                    );
                }

                grid.appendChild(
                    day
                );
            }

            shell.appendChild(
                grid
            );

            const selected =
                state
                    .calendarSelectedDate;

            const selectedEntries =
                selected
                    ? entries.filter(
                        entry =>
                            entryDateKey(
                                entry
                            ) ===
                            selected
                    )
                    : [];

            const detail =
                document
                    .createElement(
                        'section'
                    );

            detail.className =
                'journal-premium-calendar__detail';

            if (!selected) {
                text(
                    detail,
                    'p',
                    'Select a day to view reflections from that date.',
                    'journal-premium-calendar__hint'
                );
            } else if (
                !selectedEntries.length
            ) {
                text(
                    detail,
                    'p',
                    'No reflections were written on this day.',
                    'journal-premium-calendar__hint'
                );
            } else {
                text(
                    detail,
                    'h4',
                    `${selectedEntries.length} ${
                        selectedEntries.length ===
                        1
                            ? 'Reflection'
                            : 'Reflections'
                    }`,
                    'journal-premium-calendar__detail-title'
                );

                for (
                    const entry of
                    selectedEntries
                ) {
                    detail.appendChild(
                        createListEntry(
                            entry
                        )
                    );
                }
            }

            shell.appendChild(
                detail
            );

            parent.appendChild(
                shell
            );
        }

        function renderPaginatedEntries(
            parent,
            entries
        ) {
            const totalPages =
                Math.max(
                    1,
                    Math.ceil(
                        entries.length /
                        PAGE_SIZE
                    )
                );

            state.page =
                Math.min(
                    Math.max(
                        state.page,
                        1
                    ),
                    totalPages
                );

            const start =
                (
                    state.page -
                    1
                ) *
                PAGE_SIZE;

            const visible =
                entries.slice(
                    start,
                    start +
                    PAGE_SIZE
                );

            const list =
                doc()
                    .createElement(
                        'div'
                    );

            list.className =
                state.view ===
                    'grid'
                    ? 'journal-premium-grid'
                    : 'journal-premium-list';

            for (
                const entry of visible
            ) {
                list.appendChild(
                    state.view ===
                        'grid'
                        ? createGridEntry(
                            entry
                        )
                        : createListEntry(
                            entry
                        )
                );
            }

            parent.appendChild(
                list
            );

            if (
                totalPages <= 1
            ) {
                return;
            }

            const pagination =
                doc()
                    .createElement(
                        'nav'
                    );

            pagination.className =
                'journal-premium-pagination';

            pagination.setAttribute(
                'aria-label',
                'Journal pages'
            );

            const previous =
                button(
                    'Previous',
                    '',
                    () => {
                        if (
                            state.page >
                            1
                        ) {
                            state.page -=
                                1;

                            renderCurrent();
                        }
                    }
                );

            previous.disabled =
                state.page <= 1;

            const info =
                text(
                    null,
                    'span',
                    `Page ${state.page} of ${totalPages}`
                );

            const next =
                button(
                    'Next',
                    '',
                    () => {
                        if (
                            state.page <
                            totalPages
                        ) {
                            state.page +=
                                1;

                            renderCurrent();
                        }
                    }
                );

            next.disabled =
                state.page >=
                totalPages;

            pagination.append(
                previous,
                info,
                next
            );

            parent.appendChild(
                pagination
            );
        }

        function renderCurrent(
            options = {}
        ) {
            const document =
                doc();

            const container =
                document &&
                document
                    .getElementById(
                        'journalsContainer'
                    );

            if (!container) {
                return;
            }

            enhanceShell();

            const entries =
                getEntries();

            const filtered =
                filterEntries(
                    entries,
                    state.query,
                    state.mood
                );

            container
                .replaceChildren();

            const rootPanel =
                document
                    .createElement(
                        'div'
                    );

            rootPanel.className =
                'journal-premium-experience';

            rootPanel.appendChild(
                createToolbar(
                    entries,
                    filtered
                )
            );

            const content =
                document
                    .createElement(
                        'div'
                    );

            content.className =
                'journal-premium-content';

            if (!filtered.length) {
                renderEmptyState(
                    content,
                    Boolean(
                        state.query ||
                        state.mood !==
                            'all'
                    )
                );
            } else if (
                state.view ===
                    'calendar'
            ) {
                renderCalendar(
                    content,
                    filtered
                );
            } else {
                renderPaginatedEntries(
                    content,
                    filtered
                );
            }

            rootPanel.appendChild(
                content
            );

            container.appendChild(
                rootPanel
            );

            if (
                options.focusSearch
            ) {
                const search =
                    container
                        .querySelector(
                            '.journal-premium-search'
                        );

                if (search) {
                    search.focus();

                    const position =
                        Number.isInteger(
                            options.caret
                        )
                            ? options.caret
                            : search
                                .value
                                .length;

                    try {
                        search
                            .setSelectionRange(
                                position,
                                position
                            );
                    } catch (error) {
                        // Search remains usable.
                    }
                }
            }
        }

        function wrapJournalLoader() {
            const discipleship =
                root &&
                root.V2Discipleship;

            if (!discipleship) {
                return false;
            }

            if (
                discipleship
                    .__premiumJournalWrapped ===
                    true
            ) {
                return true;
            }

            const previousLoad =
                discipleship
                    .loadJournals;

            if (
                typeof previousLoad !==
                    'function'
            ) {
                return false;
            }

            discipleship.loadJournals =
                async function premiumJournalLoad(
                    ...args
                ) {
                    const result =
                        await previousLoad
                            .apply(
                                this,
                                args
                            );

                    enhanceShell();

                    renderCurrent();

                    return result;
                };

            discipleship
                .__premiumJournalWrapped =
                true;

            return true;
        }

        function install() {
            if (state.installed) {
                enhanceShell();
                wrapJournalLoader();
                return true;
            }

            state.installed =
                true;

            enhanceShell();

            const wrapped =
                wrapJournalLoader();

            const document =
                doc();

            if (
                document &&
                document.body &&
                typeof root.MutationObserver ===
                    'function'
            ) {
                const observer =
                    new root
                        .MutationObserver(
                            () => {
                                const ready =
                                    enhanceShell();

                                wrapJournalLoader();

                                if (
                                    ready &&
                                    document
                                        .getElementById(
                                            'journalsContainer'
                                        )
                                ) {
                                    observer
                                        .disconnect();
                                }
                            }
                        );

                observer.observe(
                    document.body,
                    {
                        childList:
                            true,
                        subtree:
                            true
                    }
                );

                root.setTimeout(
                    () =>
                        observer.disconnect(),
                    15000
                );
            }

            if (
                wrapped &&
                root
                    .V2Discipleship &&
                Array.isArray(
                    root
                        .V2Discipleship
                        .journalsData
                )
            ) {
                renderCurrent();
            }

            return true;
        }

        return Object.freeze({
            install,
            render:
                renderCurrent,

            openWriter,
            openJournalList,

            _testing:
                Object.freeze({
                    filterEntries,
                    uniqueMoods,
                    entryDateKey,
                    previewText,
                    calendarCells
                })
        });
    }
);

if (
    typeof window !== 'undefined' &&
    window.FOGJournalPremiumUI
) {
    window
        .FOGJournalPremiumUI
        .install();
}
