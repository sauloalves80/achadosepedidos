let filtroAtual = '';
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
            filtroAtual = btn.dataset.tipo;
            carregarItens();
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

function previewFoto(input) {
    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function carregarItens(busca = '') {
    let url = '/api/itens?';
    if (filtroAtual) url += 'tipo=' + filtroAtual + '&';
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
            if (item.foto) {
                fotoHtml = '<div class="item-foto"><img src="' + item.foto + '" alt="Foto do item"></div>';
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
    document.getElementById('foto-preview').style.display = 'none';
    document.getElementById('foto-placeholder').style.display = 'block';
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

    const fotoInput = document.getElementById('foto-input');
    if (fotoInput.files.length > 0) {
        try {
            const fotoComprimida = await comprimirImagem(fotoInput.files[0]);
            formData.append('foto', fotoComprimida);
        } catch (erroCompressao) {
            console.error('Erro ao comprimir imagem:', erroCompressao);
            formData.append('foto', fotoInput.files[0]);
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
        // Entra em tela cheia
        if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                resizeCanvasForFullscreen();
            });
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
            resizeCanvasForFullscreen();
        }
    } else {
        // Sai de tela cheia
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        // Redimensiona canvas de volta ao tamanho normal
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
