import urllib.request, json
from itertools import combinations

import os

URL = os.environ.get('SUPABASE_URL', 'https://nujzwirwcdlkytgldfsp.supabase.co')
SVC = os.environ.get('SERVICE_ROLE_KEY', '')

EMAILS_TESTE = [
    'julianacore2@gmail.com',
    'ana.silva@teste.com',
    'beatriz.souza@teste.com',
    'carolina.lima@teste.com',
    'daniela.costa@teste.com',
    'eduarda.ferreira@teste.com',
    'fernanda.rocha@teste.com',
    'gabriela.mendes@teste.com',
    'helena.barros@teste.com',
    'isabela.nunes@teste.com',
    'julia.cardoso@teste.com',
    'larissa.oliveira@teste.com',
]

HEADERS = {
    'apikey': SVC,
    'Authorization': 'Bearer ' + SVC,
    'Content-Type': 'application/json',
    'User-Agent': 'python'
}

def req(method, path, body=None, extra=None):
    h = {**HEADERS, **(extra or {})}
    r = urllib.request.Request(URL + path, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return True, json.loads(raw) if raw else {}
    except Exception as e:
        raw = e.read().decode() if hasattr(e, 'read') else str(e)
        return False, raw

# 1. Busca UIDs de todos os usuarios
print('Buscando UIDs...')
ok, data = req('GET', '/auth/v1/admin/users?page=1&per_page=500')
if not ok:
    print('ERRO ao buscar usuarios:', data)
    exit(1)

users_list = data.get('users', data) if isinstance(data, dict) else data
email_uid = {u['email']: u['id'] for u in users_list if u.get('email') in EMAILS_TESTE}

print(f'Encontrados: {len(email_uid)}/{len(EMAILS_TESTE)} usuarios')
for email, uid in email_uid.items():
    print(f'  {email:<40} {uid}')

if len(email_uid) < 2:
    print('Poucos usuarios encontrados. Abortando.')
    exit(1)

uids = list(email_uid.values())
pares = list(combinations(uids, 2))

print(f'\nCriando curtidas e matches para {len(pares)} pares...')

curtidas_ok = 0
curtidas_err = 0
matches_ok = 0
matches_err = 0

for uid_a, uid_b in pares:
    # Curtida A -> B
    body = json.dumps({'de_user_id': uid_a, 'para_user_id': uid_b, 'tipo': 'like'}).encode()
    ok, _ = req('POST', '/rest/v1/curtidas', body, {'Prefer': 'return=minimal'})
    if ok:
        curtidas_ok += 1
    else:
        if 'duplicate' not in str(_).lower():
            curtidas_err += 1

    # Curtida B -> A
    body = json.dumps({'de_user_id': uid_b, 'para_user_id': uid_a, 'tipo': 'like'}).encode()
    ok, _ = req('POST', '/rest/v1/curtidas', body, {'Prefer': 'return=minimal'})
    if ok:
        curtidas_ok += 1
    else:
        if 'duplicate' not in str(_).lower():
            curtidas_err += 1

    # Match
    body = json.dumps({'usuario_a_id': uid_a, 'usuario_b_id': uid_b, 'status': 'ativo'}).encode()
    ok, resp_data = req('POST', '/rest/v1/matches', body, {'Prefer': 'return=minimal'})
    if ok:
        matches_ok += 1
    else:
        if 'duplicate' not in str(resp_data).lower():
            matches_err += 1
            print(f'  ERRO match: {str(resp_data)[:80]}')

print()
print('=' * 50)
print(f'Curtidas criadas : {curtidas_ok}')
print(f'Curtidas erro    : {curtidas_err}')
print(f'Matches criados  : {matches_ok}')
print(f'Matches erro     : {matches_err}')
print(f'Total de matches : {len(pares)} (todos os pares possiveis)')
print()

# Conta matches que a julianacore2 tem
juliana_uid = email_uid.get('julianacore2@gmail.com')
if juliana_uid:
    ok, mdata = req('GET', f'/rest/v1/matches?or=(usuario_a_id.eq.{juliana_uid},usuario_b_id.eq.{juliana_uid})&status=eq.ativo')
    if ok:
        print(f'Matches da Juliana: {len(mdata)}')
    print()

print('Pronto! Abra o app e veja a lista de conversas.')
