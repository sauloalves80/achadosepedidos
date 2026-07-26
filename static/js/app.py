from flask import Flask, render_template, request, jsonify, send_from_directory
from database import get_db, init_db, DATABASE_URL, adapt_query, adapt_params
import os
import uuid
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET')
)

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.before_request
def setup():
    init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/itens', methods=['GET'])
def listar_itens():
    db = get_db()
    try:
        tipo = request.args.get('tipo')
        busca = request.args.get('busca', '')

        query = 'SELECT * FROM itens WHERE 1=1'
        params = []

        if tipo:
            query += ' AND tipo = ?'
            params.append(tipo)

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

        foto_url = None
        if 'foto' in request.files:
            foto = request.files['foto']
            if foto.filename:
                try:
                    result = cloudinary.uploader.upload(foto, folder='achados-perdidos')
                    foto_url = result['secure_url']
                except Exception as erro_upload:
                    return jsonify({'erro': f'Falha ao enviar a foto: {str(erro_upload)}'}), 400

        cur = db.cursor()
        sql = '''INSERT INTO itens (nome, descricao, local, data_registro, tipo, matricula, encontrado_por, foto)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'''
        cur.execute(adapt_query(sql), adapt_params([nome, descricao, local, data_registro, tipo, matricula, encontrado_por, foto_url]))
        db.commit()
        return jsonify({'mensagem': 'Item criado com sucesso!'}), 201
    finally:
        db.close()

@app.route('/api/itens/<int:id>/status', methods=['PUT'])
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
def deletar_item(id):
    db = get_db()
    try:
        cur = db.cursor()
        cur.execute(adapt_query('SELECT foto FROM itens WHERE id = ?'), adapt_params([id]))
        item = cur.fetchone()
        if item and item['foto']:
            try:
                public_id = item['foto'].split('/')[-1].split('.')[0]
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
