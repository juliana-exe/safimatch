import urllib.request, json

import os

URL = os.environ.get('SUPABASE_URL', 'https://nujzwirwcdlkytgldfsp.supabase.co')
SVC = os.environ.get('SERVICE_ROLE_KEY', '')
SENHA = 'Teste@123'

PERFIS = [
    {'email':'ana.silva@teste.com',       'nome':'Ana Silva',        'nascimento':'1997-03-14','cidade':'Sao Paulo',      'estado':'SP','orientacao':'lesbica',          'bio':'Amo viajar e fotografia 📷',               'interesses':['viagens','fotografia','musica']},
    {'email':'beatriz.souza@teste.com',   'nome':'Beatriz Souza',    'nascimento':'1995-07-22','cidade':'Rio de Janeiro',  'estado':'RJ','orientacao':'bissexual',        'bio':'Apaixonada por arte e culinaria 🍕',        'interesses':['arte','culinaria','leitura']},
    {'email':'carolina.lima@teste.com',   'nome':'Carolina Lima',    'nascimento':'2000-11-05','cidade':'Belo Horizonte',  'estado':'MG','orientacao':'pansexual',        'bio':'Estudante de psicologia e fa de K-pop 🎵', 'interesses':['psicologia','kpop','series']},
    {'email':'daniela.costa@teste.com',   'nome':'Daniela Costa',    'nascimento':'1993-01-30','cidade':'Curitiba',        'estado':'PR','orientacao':'lesbica',          'bio':'Engenheira, adoro acampar e trilhas 🏕️',   'interesses':['natureza','trilhas','tecnologia']},
    {'email':'eduarda.ferreira@teste.com','nome':'Eduarda Ferreira',  'nascimento':'1998-09-18','cidade':'Porto Alegre',   'estado':'RS','orientacao':'bissexual',        'bio':'Musicista e professora de yoga 🧘',         'interesses':['yoga','musica','meditacao']},
    {'email':'fernanda.rocha@teste.com',  'nome':'Fernanda Rocha',   'nascimento':'1996-04-03','cidade':'Salvador',        'estado':'BA','orientacao':'lesbica',          'bio':'Advogada e ativista LGBTQ+ 🏳️‍🌈',            'interesses':['direito','politica','danca']},
    {'email':'gabriela.mendes@teste.com', 'nome':'Gabriela Mendes',  'nascimento':'2001-06-27','cidade':'Fortaleza',       'estado':'CE','orientacao':'pansexual',        'bio':'Criadora de conteudo e vegana 🌱',          'interesses':['vegano','criacao','esportes']},
    {'email':'helena.barros@teste.com',   'nome':'Helena Barros',    'nascimento':'1994-12-09','cidade':'Manaus',          'estado':'AM','orientacao':'outro',            'bio':'Biologa, apaixonada pela Amazonia 🌿',      'interesses':['natureza','ciencia','leitura']},
    {'email':'isabela.nunes@teste.com',   'nome':'Isabela Nunes',    'nascimento':'1999-02-15','cidade':'Recife',          'estado':'PE','orientacao':'lesbica',          'bio':'Designer e amante de games 🎮',             'interesses':['games','design','anime']},
    {'email':'julia.cardoso@teste.com',   'nome':'Julia Cardoso',    'nascimento':'1992-08-20','cidade':'Brasilia',        'estado':'DF','orientacao':'bissexual',        'bio':'Medica e corredora de maratona 🏃',         'interesses':['corrida','medicina','podcasts']},
    {'email':'larissa.oliveira@teste.com','nome':'Larissa Oliveira',  'nascimento':'2002-05-11','cidade':'Florianopolis',  'estado':'SC','orientacao':'prefiro_nao_dizer','bio':'Surfista e estudante de oceanografia 🏄',   'interesses':['surf','oceano','viagens']},
]

HEADERS = {
    'apikey': SVC,
    'Authorization': 'Bearer ' + SVC,
    'Content-Type': 'application/json',
    'User-Agent': 'python'
}

def req(method, path, body=None, extra_headers=None):
    h = {**HEADERS, **(extra_headers or {})}
    r = urllib.request.Request(URL + path, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return True, json.loads(raw) if raw else {}
    except Exception as e:
        raw = e.read().decode() if hasattr(e, 'read') else str(e)
        return False, raw

def get_uid_by_email(email):
    ok, data = req('GET', '/auth/v1/admin/users?page=1&per_page=500')
    if not ok:
        return None
    users = data.get('users', data) if isinstance(data, dict) else data
    return next((u['id'] for u in users if u.get('email') == email), None)

print('=' * 60)
print('Criando 11 perfis de teste')
print(f'Senha padrao para todos: {SENHA}')
print('=' * 60)

criados = []
for p in PERFIS:
    # 1. Cria usuario
    body = json.dumps({'email': p['email'], 'password': SENHA, 'email_confirm': True}).encode()
    ok, data = req('POST', '/auth/v1/admin/users', body)
    if ok:
        uid = data['id']
        status_user = 'CRIADO'
    else:
        if 'already' in str(data).lower():
            uid = get_uid_by_email(p['email'])
            status_user = 'JA_EXISTE'
        else:
            print(f'ERRO user {p["email"]}: {str(data)[:80]}')
            continue

    if not uid:
        print(f'ERRO: nao encontrou uid para {p["email"]}')
        continue

    # 2. Cria perfil
    perfil_body = json.dumps({
        'user_id': uid,
        'nome': p['nome'],
        'bio': p['bio'],
        'data_nascimento': p['nascimento'],
        'cidade': p['cidade'],
        'estado': p['estado'],
        'orientacao': p['orientacao'],
        'interesses': p['interesses'],
        'fotos': [],
        'foto_principal': None,
        'verificada': False,
        'ativa': True
    }).encode()
    ok2, data2 = req('POST', '/rest/v1/perfis', perfil_body, {'Prefer': 'return=minimal'})
    if ok2:
        status_perf = 'PERFIL_OK'
    elif 'duplicate' in str(data2).lower():
        status_perf = 'PERFIL_JA_EXISTE'
    else:
        status_perf = f'PERFIL_ERRO: {str(data2)[:60]}'

    icon = 'OK' if 'ERRO' not in status_perf else 'XX'
    print(f'  [{icon}] {p["nome"]:<22} | {p["email"]:<35} | {status_user} | {status_perf}')
    criados.append(p)

print()
print('=' * 60)
print(f'RESULTADO: {len(criados)}/11 perfis prontos')
print(f'Senha: {SENHA}')
print()
print('Lista de logins para teste:')
for p in criados:
    print(f'  {p["email"]:<35} | {SENHA}')
print()
print('Obs: todos com email ja confirmado (sem necessidade de clicar no link)')
