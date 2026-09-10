(() => {
    'use strict';

    const search = document.getElementById('search');
    const previewControls = document.getElementById('previewControls');
    const previewAs = document.getElementById('previewAs');
    const previewNotice = document.getElementById('previewNotice');
    const chips = document.getElementById('chips');
    const root = document.getElementById('faqRoot');
    const empty = document.getElementById('empty');
    const error = document.getElementById('error');
    const loadStatus = document.getElementById('loadStatus');
    const accessLabels = Object.freeze({
        public: 'Everyone',
        member: 'Signed-in Members',
        leader: 'Leaders with Permission',
        admin: 'Administrators'
    });
    let authorizedSections = [];
    let activeRequest = null;

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createFaqItem(sectionId, item, itemIndex) {
        const article = createElement('article', 'faq-item');
        const button = createElement('button', 'faq-question');
        const answerId = `${sectionId}-answer-${itemIndex}`;
        button.type = 'button';
        button.setAttribute('aria-controls', answerId);
        button.setAttribute('aria-expanded', 'false');
        button.append(
            createElement('span', '', item.question),
            createElement('span', 'chev', '⌄')
        );

        const answer = createElement('div', 'faq-answer');
        answer.id = answerId;
        answer.hidden = true;
        answer.append(createElement('p', '', item.answer));
        button.addEventListener('click', () => {
            const willOpen = button.getAttribute('aria-expanded') !== 'true';
            button.setAttribute('aria-expanded', String(willOpen));
            answer.hidden = !willOpen;
        });
        article.append(button, answer);
        return article;
    }

    function renderSections() {
        const term = search.value.trim().toLocaleLowerCase();
        const sectionNodes = [];
        const chipNodes = [];

        for (const section of authorizedSections) {
            const matchingItems = section.items.filter(item => (
                !term || `${section.title} ${item.question} ${item.answer}`.toLocaleLowerCase().includes(term)
            ));
            if (matchingItems.length === 0) continue;

            const sectionNode = createElement('section', 'faq-section');
            sectionNode.id = section.id;
            sectionNode.dataset.access = section.audience;
            const heading = createElement('div', 'section-heading');
            const icon = createElement('span', 'section-icon', section.icon);
            icon.setAttribute('aria-hidden', 'true');
            const titleWrap = createElement('div', 'title-wrap');
            titleWrap.append(
                createElement('h2', '', section.title),
                createElement(
                    'span',
                    `access-badge access-${section.audience}`,
                    accessLabels[section.audience] || 'Available'
                )
            );
            heading.append(icon, titleWrap);
            sectionNode.append(heading);
            matchingItems.forEach((item, index) => sectionNode.append(createFaqItem(section.id, item, index)));
            sectionNodes.push(sectionNode);

            const chip = createElement('a', 'chip', section.title);
            chip.href = `#${section.id}`;
            chipNodes.push(chip);
        }

        root.replaceChildren(...sectionNodes);
        chips.replaceChildren(...chipNodes);
        empty.hidden = sectionNodes.length !== 0;
    }

    async function loadFaq(preview = 'actual') {
        if (activeRequest) activeRequest.abort();
        activeRequest = new AbortController();
        loadStatus.hidden = false;
        error.hidden = true;
        const query = preview === 'actual' ? '' : `?preview=${encodeURIComponent(preview)}`;

        try {
            const response = await fetch(`/api/help/faq${query}`, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                signal: activeRequest.signal
            });
            if (!response.ok) throw new Error('FAQ request failed');
            const payload = await response.json();
            if (!payload || !Array.isArray(payload.sections)) throw new Error('Invalid FAQ response');
            authorizedSections = payload.sections;
            previewControls.hidden = payload.canPreview !== true;
            if (payload.preview && payload.preview !== 'actual') {
                const label = payload.preview.charAt(0).toUpperCase() + payload.preview.slice(1);
                previewNotice.textContent = `Presentation Preview — ${label}. Your account and permissions are unchanged.`;
                previewNotice.hidden = false;
            } else {
                previewNotice.textContent = '';
                previewNotice.hidden = true;
            }
            renderSections();
        } catch (requestError) {
            if (requestError.name === 'AbortError') return;
            authorizedSections = [];
            root.replaceChildren();
            chips.replaceChildren();
            previewNotice.textContent = '';
            previewNotice.hidden = true;
            empty.hidden = true;
            error.hidden = false;
        } finally {
            loadStatus.hidden = true;
        }
    }

    search.addEventListener('input', renderSections);
    previewAs.addEventListener('change', () => loadFaq(previewAs.value));
    loadFaq();
})();
