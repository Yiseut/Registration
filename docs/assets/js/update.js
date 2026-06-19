(async function initUpdatePage() {
  const { loadJSON } = window.RI;
  const commandButtons = Array.from(document.querySelectorAll('[data-copy-target]'));
  const toast = document.getElementById('update-toast');

  try {
    const [overview, manifest] = await Promise.all([
      loadJSON('assets/data/overview.json'),
      loadJSON('assets/data/manifest.json'),
    ]);
    const generatedAt = overview.generated_at || manifest.generated_at || '';
    const formatted = formatGeneratedAt(generatedAt);
    setText('update-generated', formatted || '—');
    setText('update-generated-inline', formatted || '—');
    setText('update-main-records', overview.kpi?.main_records ?? '—');
  } catch (error) {
    setText('update-generated', '读取失败');
    setText('update-generated-inline', '读取失败');
    setText('update-main-records', '—');
    showToast('当前发布数据读取失败，请检查 JSON 是否生成。');
  }

  commandButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      const text = target?.textContent?.trim() || '';
      if (!text) return;
      try {
        await copyText(text);
        showToast('已复制到剪贴板。');
      } catch (error) {
        showToast('复制失败，请手动选中命令。');
      }
    });
  });

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function formatGeneratedAt(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }
})();
