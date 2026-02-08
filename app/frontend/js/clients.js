/**
 * Логика страницы базы клиентов
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    loadClients();
});

async function loadClients() {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('clientsTable');
    const tbody = document.getElementById('clientsBody');
    const countEl = document.getElementById('clientCount');

    try {
        const response = await fetch(`${API_BASE}/users`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const users = await response.json();

        loading.classList.add('hidden');

        if (!users || users.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        countEl.textContent = `Всего: ${users.length}`;
        tbody.innerHTML = '';

        for (const u of users) {
            const tr = document.createElement('tr');
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
            const birthDate = u.birth_date ? formatDate(u.birth_date) : '—';
            const place = u.birth_place || '—';
            const created = u.created_at ? formatDateTime(u.created_at) : '—';

            tr.innerHTML = `
                <td><strong>${escapeHtml(name)}</strong></td>
                <td>${birthDate}</td>
                <td>${escapeHtml(place)}</td>
                <td>${created}</td>
                <td class="clients-actions">
                    <button class="btn-open" onclick="openChart('${u.user_id}')">Открыть</button>
                    <button class="btn-delete" onclick="deleteUser('${u.user_id}', this)">Удалить</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

        table.classList.remove('hidden');
    } catch (err) {
        loading.textContent = 'Ошибка загрузки: ' + err.message;
        console.error(err);
    }
}

async function openChart(userId) {
    try {
        const response = await fetch(`${API_BASE}/natal/${userId}`);
        if (!response.ok) throw new Error('Карта не найдена');
        const chartData = await response.json();

        AstroAPI.saveChartToSession(chartData);
        showPageLoader();
        window.location.href = '/chart.html';
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function deleteUser(userId, btn) {
    if (!confirm('Удалить пользователя и все его данные?')) return;

    btn.disabled = true;
    btn.textContent = '...';

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Ошибка удаления');

        // Удаляем строку из таблицы
        btn.closest('tr').remove();

        // Обновляем счётчик
        const rows = document.getElementById('clientsBody').querySelectorAll('tr');
        const countEl = document.getElementById('clientCount');
        if (rows.length === 0) {
            document.getElementById('clientsTable').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
            countEl.textContent = '';
        } else {
            countEl.textContent = `Всего: ${rows.length}`;
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Удалить';
    }
}

function formatDate(isoDate) {
    const [y, m, d] = isoDate.split('-');
    return `${d}.${m}.${y}`;
}

function formatDateTime(isoStr) {
    try {
        const dt = new Date(isoStr);
        return dt.toLocaleDateString('ru-RU') + ' ' + dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return isoStr;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

