document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. i18n (Internationalization) ---
    const langSwitcher = document.getElementById('lang-switcher');
    let currentLang = localStorage.getItem('rurulab_lang') || 'es';

    const loadTranslations = async (lang) => {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) throw new Error('Locale not found');
            const translations = await response.json();
            applyTranslations(translations);
            // Notify other components if needed
            window.dispatchEvent(new CustomEvent('i18nReady', { detail: translations }));
            return translations;
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    };

    const applyTranslations = (t) => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const keys = key.split('.');
            let value = t;
            keys.forEach(k => {
                if (value) value = value[k];
            });
            if (value) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = value;
                } else {
                    // Use innerHTML to support <br> or <span> in translations
                    el.innerHTML = value;
                }
            }
        });
        document.documentElement.lang = currentLang;
    };

    // Use a small delay to ensure nav is loaded if using public-nav-placeholder
    setTimeout(() => {
        const switcher = document.getElementById('lang-switcher');
        if (switcher) {
            switcher.value = currentLang;
            switcher.addEventListener('change', (e) => {
                currentLang = e.target.value;
                localStorage.setItem('rurulab_lang', currentLang);
                loadTranslations(currentLang);
            });
        }
    }, 500);

    // --- 2. Dynamic Stats ---
    const fetchStats = async () => {
        try {
            const response = await fetch('/api/landing/stats');
            const result = await response.json();
            if (result.success && result.data) {
                const d = result.data;
                const animateValue = (id, start, end, duration) => {
                    const obj = document.getElementById(id);
                    if (!obj) return;
                    if (isNaN(end)) {
                        obj.textContent = end;
                        return;
                    }
                    let startTimestamp = null;
                    const step = (timestamp) => {
                        if (!startTimestamp) startTimestamp = timestamp;
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                        obj.innerHTML = Math.floor(progress * (end - start) + start);
                        if (progress < 1) {
                            window.requestAnimationFrame(step);
                        }
                    };
                    window.requestAnimationFrame(step);
                };

                animateValue('stat-batches', 0, d.total_batches || 0, 2000);
                animateValue('stat-hectares', 0, d.total_hectares || 0, 2000);
                animateValue('stat-countries', 0, d.countries_covered || 0, 2000);
                // For companies, we might have a string or number
                const compVal = document.getElementById('stat-companies');
                if (compVal) compVal.textContent = d.total_companies || '0';
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    // --- 3. Stepper Interactivity ---
    const initStepper = () => {
        const container = document.getElementById('stepper-container');
        if (!container) return;

        const steps = container.querySelectorAll('.chain-step');
        steps.forEach(step => {
            step.addEventListener('mouseenter', () => {
                steps.forEach(s => s.querySelector('.chain-icon').style.transform = '');
                step.querySelector('.chain-icon').style.transform = 'scale(1.2) rotate(5deg)';
                step.querySelector('.chain-icon').style.backgroundColor = '#78350f';
                step.querySelector('.chain-icon').style.color = '#fff';
            });
            step.addEventListener('mouseleave', () => {
                step.querySelector('.chain-icon').style.transform = '';
                if (step.id !== 'step-mercado') {
                    step.querySelector('.chain-icon').style.backgroundColor = '';
                    step.querySelector('.chain-icon').style.color = '';
                }
            });
        });
    };

    // --- 4. Widget Embed Copy ---
    const initWidgetCopy = (t) => {
        const btn = document.getElementById('copy-widget-btn');
        const code = document.getElementById('embed-code');
        if (!btn || !code) return;

        btn.addEventListener('click', () => {
            const text = code.textContent.trim();
            navigator.clipboard.writeText(text).then(() => {
                const originalText = btn.innerHTML;
                const copiedLabel = (t && t.widgets && t.widgets.copied) ? t.widgets.copied : '¡Copiado!';
                btn.innerHTML = `<i class="fas fa-check"></i> ${copiedLabel}`;
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            });
        });
    };

    // --- 5. Widget Switcher ---
    window.switchWidget = (type) => {
        const iframe = document.querySelector('#widgets iframe');
        const code = document.getElementById('embed-code');
        const btns = document.querySelectorAll('.widget-btn');
        const baseUrl = 'https://rurulab.com/widget';

        // Update UI
        btns.forEach(b => {
            b.classList.remove('bg-amber-900', 'text-white');
            b.classList.add('bg-stone-800', 'text-stone-400');
        });
        const activeBtn = document.querySelector(`.widget-btn[data-type="${type}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-stone-800', 'text-stone-400');
            activeBtn.classList.add('bg-amber-900', 'text-white');
        }

        if (type === 'radar') {
            iframe.src = `${baseUrl}/radar/d624ac19-b8c3-45d2-8eed-da6e4272ecad`;
            code.innerHTML = `&lt;iframe src="${baseUrl}/radar/d624ac19-b8c3-45d2-8eed-da6e4272ecad" \n        width="100%" height="500" frameborder="0"&gt;&lt;/iframe&gt;`;
        } else {
            iframe.src = `${baseUrl}/rueda/c3e32616-7021-4fb5-82cf-c3c89c3fee02`;
            code.innerHTML = `&lt;iframe src="${baseUrl}/rueda/c3e32616-7021-4fb5-82cf-c3c89c3fee02" \n        width="100%" height="500" frameborder="0"&gt;&lt;/iframe&gt;`;
        }
    };

    // --- 6. Initialize ---
    const translations = await loadTranslations(currentLang);
    fetchStats();
    initStepper();
    initWidgetCopy(translations);
});
