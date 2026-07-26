import os

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        conn.autocommit = False
    else:
        import sqlite3
        conn = sqlite3.connect('achados_perdidos.db')
        conn.row_factory = sqlite3.Row
    return conn

def adapt_query(sql):
    if DATABASE_URL:
        return sql.replace('?', '%s')
    return sql

def adapt_params(params):
    if DATABASE_URL:
        return tuple(params)
    return params

def init_db():
    conn = get_db()
    cur = conn.cursor()

    if DATABASE_URL:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS itens (
                id SERIAL PRIMARY KEY,
                nome TEXT NOT NULL,
                descricao TEXT,
                local TEXT NOT NULL,
                data_registro DATE NOT NULL,
                tipo TEXT NOT NULL CHECK(tipo IN ('achado', 'perdido')),
                status TEXT DEFAULT 'pendente',
                foto TEXT,
                matricula TEXT,
                encontrado_por TEXT,
                data_devolucao DATE,
                assinatura TEXT,
                nome_receptor TEXT,
                matricula_receptor TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
    else:
        import sqlite3
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='itens'")
        tabela_existe = cur.fetchone() is not None

        if not tabela_existe:
            cur.execute('''
                CREATE TABLE IF NOT EXISTS itens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    descricao TEXT,
                    local TEXT NOT NULL,
                    data_registro DATE NOT NULL,
                    tipo TEXT NOT NULL CHECK(tipo IN ('achado', 'perdido')),
                    status TEXT DEFAULT 'pendente',
                    foto TEXT,
                    matricula TEXT,
                    encontrado_por TEXT,
                    data_devolucao DATE,
                    assinatura TEXT,
                    nome_receptor TEXT,
                    matricula_receptor TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            cursor = cur.execute("PRAGMA table_info(itens)")
            columns = [row[1] for row in cursor.fetchall()]

            if 'data_devolucao' not in columns:
                cur.execute('ALTER TABLE itens ADD COLUMN data_devolucao DATE')
            if 'assinatura' not in columns:
                cur.execute('ALTER TABLE itens ADD COLUMN assinatura TEXT')
            if 'nome_receptor' not in columns:
                cur.execute('ALTER TABLE itens ADD COLUMN nome_receptor TEXT')
            if 'matricula' not in columns:
                cur.execute('ALTER TABLE itens ADD COLUMN matricula TEXT')
            if 'encontrado_por' not in columns:
                cur.execute('ALTER TABLE itens ADD COLUMN encontrado_por TEXT')
            if 'matricula_receptor' not in columns:
                cur.execute('ALTER TABLE itens ADD COLUMN matricula_receptor TEXT')

        conn.commit()

    cur.close()
    conn.close()