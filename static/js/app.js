let filtroTipoAtual = '';
let filtroStatusAtual = '';
let canvas, ctx, desenhando = false;
let temAssinatura = false;

function comprimirImagem(file, maxWidth = 1280, qualidade = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let largura = img.width;
                let altura = img.height;

                if (largura > maxWidth) {
                    altura = Math.round((altura * maxWidth) / largura);
                    largura = maxWidth;
                }

                const canvasTemp = document.createElement('canvas');
                canvasTemp.width = largura;
                canvasTemp.height = altura;
                const ctxTemp = canvasTemp.getContext('2d');
                ctxTemp.drawImage(img, 0, 0, largura, altura);

                canvasTemp.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Falha ao comprimir imagem'));
                        return;
                    }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
                        type: 'image/jpeg'
                    }));
                }, 'image/jpeg', qualidade);
            };
            img.onerror = () => reject(new Error('Falha ao carregar imagem'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

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

    document.getElementById('form-item').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarItem();
    });

    document.getElementById('form-devolucao').addEventListener('submit', (e) => {
        e.preventDefault();
        confirmarDevolucao();
    });
});

function initSignaturePad() {
    canvas = document.getElementById('canvas-assinatura');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    canvas.width = canvas.offsetWidth;
    canvas.height = 150;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    canvas.ontouchstart = function(e) {
        e.preventDefault();
        desenhando = true;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    };

    canvas.ontouchmove = function(e) {
        e.preventDefault();
        if (!desenhando) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        ctx.stroke();
        temAssinatura = true;
    };

    canvas.ontouchend = function(e) {
        e.preventDefault();
        desenhando = false;
    };

    canvas.onmousedown = function(e) {
        desenhando = true;
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
    };

    canvas.onmousemove = function(e) {
        if (!desenhando) return;
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        temAssinatura = true;
    };

    canvas.onmouseup = function() { desenhando = false; };
    canvas.onmouseleave = function() { desenhando = false; };
}

function limparAssinatura() {
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    temAssinatura = false;
}

const MAX_FOTOS = 3;
let fotosSelecionadas = [null, null, null];
let slotAtual = null;

function selecionarFoto(index) {
    slotAtual = index;
    document.getElementById('foto-input').click();
}

function fotoSelecionada(input) {
    if (slotAtual === null || !input.files || !input.files[0]) return;
    fotosSelecionadas[slotAtual] = input.files[0];
    renderizarSlotsFoto();
    input.value = '';
    slotAtual = null;
}

function removerFoto(index) {
    fotosSelecionadas[index] = null;
    renderizarSlotsFoto();
}

function renderizarSlotsFoto() {
    for (let i = 0; i < MAX_FOTOS; i++) {
        const slot = document.querySelector('.foto-slot[data-index="' + i + '"]');
        const arquivo = fotosSelecionadas[i];
        if (arquivo) {
            const url = URL.createObjectURL(arquivo);
            slot.classList.add('preenchido');
            slot.innerHTML = '<img src="' + url + '" alt="Foto ' + (i + 1) + '">' +
                '<button type="button" class="remover-foto" onclick="event.stopPropagation(); removerFoto(' + i + ')">&times;</button>';
        } else {
            slot.classList.remove('preenchido');
            slot.innerHTML = '<span class="foto-slot-placeholder">+</span>';
        }
    }
}

function limparFotosForm() {
    fotosSelecionadas = [null, null, null];
    slotAtual = null;
    renderizarSlotsFoto();
}

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
    let url = '/api/itens?';
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
                    '<p><strong>Recebido por:</strong> ' + (item.nome_receptor || '') + '</p>' +
                    (item.matricula_receptor ? '<p><strong>Matricula:</strong> ' + item.matricula_receptor + '</p>' : '') +
                    (item.assinatura ? '<p><strong>Assinatura:</strong><br><img src="' + item.assinatura + '" alt="Assinatura"></p>' : '') +
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
                    (item.matricula ? '<p>Matricula: ' + item.matricula + '</p>' : '') +
                    (item.encontrado_por ? '<p>Encontrado por: ' + item.encontrado_por + '</p>' : '') +
                '</div>' +
                '<div class="item-status">' +
                    '<span class="status-badge ' + item.status + '">' + item.status + '</span>' +
                    '<div>' +
                        (item.status === 'pendente' ?
                            '<button class="btn-status btn-devolver" onclick="abrirModalDevolucao(' + item.id + ')">Devolvido</button>' : '') +
                        '<button class="btn-status btn-deletar" onclick="deletarItem(' + item.id + ')">Excluir</button>' +
                    '</div>' +
                '</div>' +
                devolucaoHtml +
            '</div>';
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar itens:', error);
    }
}

function abrirModal() {
    document.getElementById('modal').classList.add('ativo');
    document.getElementById('data').valueAsDate = new Date();
}

function fecharModal() {
    document.getElementById('modal').classList.remove('ativo');
    document.getElementById('form-item').reset();
    limparFotosForm();
}

function abrirModalDevolucao(id) {
    document.getElementById('devolucao-id').value = id;
    document.getElementById('data-devolucao').valueAsDate = new Date();
    temAssinatura = false;
    document.getElementById('modal-devolucao').classList.add('ativo');
    setTimeout(function() {
        initSignaturePad();
    }, 200);
}

function fecharModalDevolucao() {
    document.getElementById('modal-devolucao').classList.remove('ativo');
    document.getElementById('form-devolucao').reset();
    temAssinatura = false;
}

async function salvarItem() {
    const formData = new FormData();
    formData.append('nome', document.getElementById('nome').value);
    formData.append('descricao', document.getElementById('descricao').value);
    formData.append('local', document.getElementById('local').value);
    formData.append('data_registro', document.getElementById('data').value);
    formData.append('tipo', document.getElementById('tipo').value);
    formData.append('matricula', document.getElementById('matricula').value);
    formData.append('encontrado_por', document.getElementById('encontrado_por').value);

    for (const arquivo of fotosSelecionadas) {
        if (!arquivo) continue;
        try {
            const fotoComprimida = await comprimirImagem(arquivo);
            formData.append('fotos', fotoComprimida);
        } catch (erroCompressao) {
            console.error('Erro ao comprimir imagem:', erroCompressao);
            formData.append('fotos', arquivo);
        }
    }

    try {
        const resposta = await fetch('/api/itens', {
            method: 'POST',
            body: formData
        });

        if (!resposta.ok) {
            let mensagemErro = 'Erro ao salvar item!';
            try {
                const dadosErro = await resposta.json();
                if (dadosErro && dadosErro.erro) {
                    mensagemErro = dadosErro.erro;
                }
            } catch (e) {}
            alert(mensagemErro);
            return;
        }

        fecharModal();
        carregarItens();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao conectar com o servidor!');
    }
}

async function confirmarDevolucao() {
    var id = document.getElementById('devolucao-id').value;
    var dataDevolucao = document.getElementById('data-devolucao').value;
    var nomeReceptor = document.getElementById('nome-receptor').value;
    var matriculaReceptor = document.getElementById('matricula-receptor').value;

    if (!temAssinatura) {
        alert('Por favor, assine antes de confirmar!');
        return;
    }

    if (!dataDevolucao || !nomeReceptor || !matriculaReceptor) {
        alert('Preencha todos os campos!');
        return;
    }

    var assinatura = canvas.toDataURL('image/png');

    var dados = {
        status: 'devolvido',
        data_devolucao: dataDevolucao,
        nome_receptor: nomeReceptor,
        matricula_receptor: matriculaReceptor,
        assinatura: assinatura
    };

    try {
        var response = await fetch('/api/itens/' + id + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (response.ok) {
            fecharModalDevolucao();
            carregarItens();
        } else {
            alert('Erro ao devolver item!');
        }
    } catch (error) {
        console.error('Erro na devolucao:', error);
        alert('Erro ao conectar com o servidor!');
    }
}

async function deletarItem(id) {
    if (confirm('Tem certeza que deseja remover?')) {
        try {
            await fetch('/api/itens/' + id, { method: 'DELETE' });
            carregarItens();
        } catch (error) {
            console.error('Erro ao deletar:', error);
        }
    }
}

function toggleFullscreenSignature() {
    const canvas = document.getElementById('canvas-assinatura');
    const container = canvas.parentElement;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                resizeCanvasForFullscreen();
            });
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
            resizeCanvasForFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        setTimeout(() => {
            canvas.width = canvas.offsetWidth;
            canvas.height = 150;
            inicializarCanvas();
        }, 100);
    }
}

function resizeCanvasForFullscreen() {
    const canvas = document.getElementById('canvas-assinatura');
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.9;
    inicializarCanvas();
}

function inicializarCanvas() {
    const canvas = document.getElementById('canvas-assinatura');
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
}
