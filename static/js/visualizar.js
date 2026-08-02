let filtroTipoAtual = '';
let filtroStatusAtual = '';

document.addEventListener('DOMContentLoaded', () => {
    carregarItens();

    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtroTipoAtual = btn.dataset.tipo || '';
            filtroStatusAtual = btn.dataset.status || '';
            carregarItens(document.getElementById('busca').value);
        });
    });

    document.getElementById('busca').addEventListener('input', (e) => {
        carregarItens(e.target.value);
    });
});

function extrairFotos(campoFoto) {
    if (!campoFoto) return [];
    try {
        const parsed = JSON.parse(campoFoto);
        if (Array.isArray(parsed)) return parsed;
        return [String(parsed)];
    } catch (e) {
        return [campoFoto];
    }
}

function abrirLightbox(url) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').classList.add('ativo');
}

function fecharLightbox() {
    document.getElementById('lightbox').classList.remove('ativo');
    document.getElementById('lightbox-img').src = '';
}

async function carregarItens(busca = '') {
    let url = '/api/publico/itens?';
    if (filtroTipoAtual) url += 'tipo=' + filtroTipoAtual + '&';
    if (filtroStatusAtual) url += 'status=' + filtroStatusAtual + '&';
    if (busca) url += 'busca=' + busca;

    try {
        const response = await fetch(url);
        const itens = await response.json();

        const container = document.getElementById('lista-itens');
        container.innerHTML = itens.map(item => {
            let devolucaoHtml = '';
            if (item.status === 'devolvido' && item.data_devolucao) {
                devolucaoHtml = '<div class="item-devolucao">' +
                    '<p><strong>Devolvido em:</strong> ' + item.data_devolucao + '</p>' +
                    '</div>';
            }

            let fotoHtml = '';
            const fotosItem = extrairFotos(item.foto);
            if (fotosItem.length > 0) {
                fotoHtml = '<div class="item-fotos">' +
                    fotosItem.map(url => '<img src="' + url + '" alt="Foto do item" onclick="abrirLightbox(\'' + url + '\')">').join('') +
                    '</div>';
            }

            return '<div class="item-card ' + item.tipo + '">' +
                '<div class="item-header">' +
                    '<span class="item-nome">' + item.nome + '</span>' +
                    '<span class="item-tipo ' + item.tipo + '">' + item.tipo.toUpperCase() + '</span>' +
                '</div>' +
                fotoHtml +
                '<div class="item-detalhes">' +
                    '<p>Local: ' + item.local + '</p>' +
                    '<p>Data: ' + item.data_registro + '</p>' +
                    (item.descricao ? '<p>Descricao: ' + item.descricao + '</p>' : '') +
                '</div>' +
                '<div class="item-status">' +
                    '<span class="status-badge ' + item.status + '">' + item.status + '</span>' +
                '</div>' +
                devolucaoHtml +
            '</div>';
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar itens:', error);
    }
}
