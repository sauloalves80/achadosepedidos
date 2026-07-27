"""
Script para criar um usuario de acesso ao sistema.

Como usar:
- LOCAL (SQLite): python criar_usuario.py
- RENDER (Postgres): rode no "Shell" do seu servico web no painel do Render,
  ou defina a variavel DATABASE_URL localmente antes de rodar.
"""
import getpass
from werkzeug.security import generate_password_hash
from database import get_db, init_db, adapt_query, adapt_params

def criar_usuario():
    init_db()

    username = input('Nome de usuario: ').strip()
    senha = getpass.getpass('Senha: ')
    senha_confirmacao = getpass.getpass('Confirme a senha: ')

    if senha != senha_confirmacao:
        print('As senhas nao coincidem. Tente novamente.')
        return

    senha_hash = generate_password_hash(senha)

    db = get_db()
    try:
        cur = db.cursor()
        cur.execute(
            adapt_query('INSERT INTO usuarios (username, senha_hash) VALUES (?, ?)'),
            adapt_params([username, senha_hash])
        )
        db.commit()
        print(f'Usuario "{username}" criado com sucesso!')
    except Exception as e:
        print(f'Erro ao criar usuario (talvez esse nome ja exista?): {e}')
    finally:
        db.close()

if __name__ == '__main__':
    criar_usuario()
