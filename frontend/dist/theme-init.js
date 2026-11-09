// Applies the saved theme before first paint (external file so the CSP can forbid inline scripts).
try {
  var t = localStorage.getItem('cbos-theme') || 'system';
  var d = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', d);
} catch (e) {}
