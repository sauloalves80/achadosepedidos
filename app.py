from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for
from functools import wraps
from werkzeug.security import check_password_hash
from database import get_db, init_db, DATABASE_URL, adapt_query, adapt_params
import os
import uuid
import json
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET')
)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'chave-temporaria-troque-em-producao')

def login_required(f):
    @wraps(f)
    def decorada(*args, **kwargs):
        if not session.get('usuario_id'):
            if request.path.startswith('/api/'):
                return jsonify({'erro': 'Nao autenticado'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorada

UPLOAD_FOLDER = os.path.join('static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.before_request
def setup():
    init_db()

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        senha = request.form.get('senha', '')

        db = get_db()
        try:
            cur = db.cursor()
            cur.execute(adapt_query('SELECT * FROM usuarios WHERE username = ?'), adapt_params([username]))
            usuario = cur.fetchone()
        finally:
            db.close()

        if usuario and check_password_hash(usuario['senha_hash'], senha):
            session['usuario_id'] = usuario['id']
            session['username'] = usuario['username']
            return redirect(url_for('index'))
        else:
            return render_template('login.html', erro='Usuario ou senha invalidos')

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/registrar', methods=['GET', 'POST'])
def registrar():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        senha = request.form.get('senha', '')
        confirmar_senha = request.form.get('confirmar_senha', '')

        # Validações
        if not username or not senha:
            return render_template('registrar.html', erro='Usuario e senha sao obrigatorios')
        
        if senha != confirmar_senha:
            return render_template('registrar.html', erro='Senhas nao conferem')
        
        if len(senha) < 4:
            return render_template('registrar.html', erro='Senha deve ter pelo menos 4 caracteres')

        from werkzeug.security import generate_password_hash
        
        db = get_db()
        try:
            cur = db.cursor()
            # Verifica se usuário já existe
            cur.execute(adapt_query('SELECT id FROM usuarios WHERE username = ?'), adapt_params([username]))
            if cur.fetchone():
                return render_template('registrar.html', erro='Usuario ja existe')
            
            # Cria o usuário
            senha_hash = generate_password_hash(senha)
            cur.execute(
                adapt_query('INSERT INTO usuarios (username, senha_hash) VALUES (?, ?)'),
                adapt_params([username, senha_hash])
            )
            db.commit()
            return render_template('registrar.html', sucesso='Usuario criado com sucesso! Agora voce pode fazer login.')
        except Exception as e:
            db.rollback()
            return render_template('registrar.html', erro=f'Erro ao criar usuario: {str(e)}')
        finally:
            db.close()

    return render_template('registrar.html')

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/visualizar')
def visualizar():
    return render_template('visualizar.html')

@app.route('/api/publico/itens', methods=['GET'])
def listar_itens_publico():
    db = get_db()
    try:
        tipo = request.args.get('tipo')
        status = request.args.get('status')
        busca = request.args.get('busca', '')

        query = 'SELECT id, nome, descricao, local, data_registro, tipo, status, foto, data_devolucao FROM itens WHERE 1=1'
        params = []

        if tipo:
            query += ' AND tipo = ?'
            params.append(tipo)

        if status:
            query += ' AND status = ?'
            params.append(status)

        if busca:
            query += ' AND (nome LIKE ? OR descricao LIKE ? OR local LIKE ?)'
            params.extend([f'%{busca}%'] * 3)

        query += ' ORDER BY created_at DESC'
        cur = db.cursor()
        cur.execute(adapt_query(query), adapt_params(params))
        itens = cur.fetchall()
        return jsonify([dict(row) for row in itens])
    finally:
        db.close()

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/itens', methods=['GET'])
@login_required
def listar_itens():
    db = get_db()
    try:
        tipo = request.args.get('tipo')
        status = request.args.get('status')
        busca = request.args.get('busca', '')

        query = 'SELECT * FROM itens WHERE 1=1'
        params = []

        if tipo:
            query += ' AND tipo = ?'
            params.append(tipo)

        if status:
            query += ' AND status = ?'
            params.append(status)

        if busca:
            query += ' AND (nome LIKE ? OR descricao LIKE ? OR local LIKE ?)'
            params.extend([f'%{busca}%'] * 3)

        query += ' ORDER BY created_at DESC'
        cur = db.cursor()
        cur.execute(adapt_query(query), adapt_params(params))
        itens = cur.fetchall()
        return jsonify([dict(row) for row in itens])
    finally:
        db.close()

@app.route('/api/itens', methods=['POST'])
@login_required
def criar_item():
    db = get_db()
    try:
        nome = request.form.get('nome')
        descricao = request.form.get('descricao', '')
        local = request.form.get('local')
        data_registro = request.form.get('data_registro')
        tipo = request.form.get('tipo')
        matricula = request.form.get('matricula', '')
        encontrado_por = request.form.get('encontrado_por', '')

        fotos_urls = []
        arquivos_foto = request.files.getlist('fotos')
        for foto in arquivos_foto[:3]:
            if foto and foto.filename:
                try:
                    result = cloudinary.uploader.upload(foto, folder='achados-perdidos')
                    fotos_urls.append(result['secure_url'])
                except Exception as erro_upload:
                    return jsonify({'erro': f'Falha ao enviar a foto: {str(erro_upload)}'}), 400

        foto_url = json.dumps(fotos_urls) if fotos_urls else None

        cur = db.cursor()
        sql = '''INSERT INTO itens (nome, descricao, local, data_registro, tipo, matricula, encontrado_por, foto)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'''
        cur.execute(adapt_query(sql), adapt_params([nome, descricao, local, data_registro, tipo, matricula, encontrado_por, foto_url]))
        db.commit()
        return jsonify({'mensagem': 'Item criado com sucesso!'}), 201
    finally:
        db.close()

@app.route('/api/itens/<int:id>/status', methods=['PUT'])
@login_required
def atualizar_status(id):
    db = get_db()
    try:
        data = request.json
        cur = db.cursor()
        sql = '''UPDATE itens SET status = ?, data_devolucao = ?, assinatura = ?, nome_receptor = ?, matricula_receptor = ?
                 WHERE id = ?'''
        cur.execute(adapt_query(sql), adapt_params([
            data['status'],
            data.get('data_devolucao'),
            data.get('assinatura'),
            data.get('nome_receptor'),
            data.get('matricula_receptor'),
            id
        ]))
        db.commit()
        return jsonify({'mensagem': 'Status atualizado!'})
    finally:
        db.close()

@app.route('/api/itens/<int:id>', methods=['DELETE'])
@login_required
def deletar_item(id):
    db = get_db()
    try:
        cur = db.cursor()
        cur.execute(adapt_query('SELECT foto FROM itens WHERE id = ?'), adapt_params([id]))
        item = cur.fetchone()
        if item and item['foto']:
            try:
                urls = json.loads(item['foto'])
                if not isinstance(urls, list):
                    urls = [item['foto']]
            except (ValueError, TypeError):
                urls = [item['foto']]
            for url in urls:
                try:
                    public_id = url.split('/')[-1].split('.')[0]
                    cloudinary.uploader.destroy(f'achados-perdidos/{public_id}')
                except:
                    pass
        cur.execute(adapt_query('DELETE FROM itens WHERE id = ?'), adapt_params([id]))
        db.commit()
        return jsonify({'mensagem': 'Item removido!'})
    finally:
        db.close()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=False, host='0.0.0.0', port=port)
