# 💜 Safimatch — App de Namoro para Mulheres

Espaço seguro, autêntico e exclusivo para mulheres se conectarem.

---

## 🗂 Estrutura do Projeto

```
app_n/
├── App.js                         # Entrada principal
├── app.json                       # Config Expo
├── package.json                   # Dependências
├── cloudinary.js                  # Config Cloudinary (upload de fotos)
├── storage.js                     # Serviço de upload
├── login                          # Protótipo web (referência visual)
└── src/
    ├── theme/
    │   └── colors.js              # Paleta de cores + espaçamentos
    ├── navigation/
    │   └── index.js               # React Navigation (Stack + Tabs)
    ├── screens/
    │   ├── SplashScreen.js        # Tela inicial animada
    │   ├── LoginScreen.js         # Login com e-mail/senha
    │   ├── CadastroScreen.js      # Cadastro em 3 etapas
    │   ├── DescobertaScreen.js    # Feed de cards (swipe match)
    │   ├── ChatListScreen.js      # Lista de conversas e matches
    │   ├── ChatScreen.js          # Chat individual
    │   ├── PerfilScreen.js        # Perfil da usuária
    │   └── ConfiguracaoScreen.js  # Ajustes e preferências
    └── components/
        ├── BotaoGradiente.js      # Botão reutilizável com gradiente
        └── AvatarVerificado.js    # Avatar com badge de verificação
```

---

## 🚀 Como rodar

### 1. Instalar dependências
```bash
cd app_n
npm install
```

### 2. Iniciar o Expo
```bash
npx expo start
```

### 3. Abrir no celular
- Instale o app **Expo Go** no Android ou iPhone
- Escaneie o QR code exibido no terminal

---

## 📱 Telas

| Tela | Descrição |
|------|-----------|
| **Splash** | Tela de boas-vindas com animação |
| **Login** | Autenticação por e-mail e senha |
| **Cadastro** | 3 etapas: acesso → perfil → preferências |
| **Descoberta** | Cards de perfis com swipe (like/nope/super like) |
| **Chat** | Lista de matches + chat individual |
| **Perfil** | Edição de fotos, bio, interesses |
| **Configurações** | Filtros, notificações, privacidade |

---

## 🎨 Paleta de Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| Primary | `#C2185B` | Botões, ícones principais |
| Primary Light | `#E91E8C` | Gradientes |
| Secondary | `#7B1FA2` | Roxo complementar |
| Like | `#E91E8C` | Botão curtir |
| Super Like | `#FFC107` | Botão super like |
| Success | `#2E7D32` | Sucesso / Online |

---

## 🔧 Próximos passos (Backend)

- [ ] Integrar Firebase Auth (login/cadastro real)
- [ ] Firestore para perfis e matches
- [ ] Firebase Storage ou Cloudinary para fotos
- [ ] Sistema de notificações push (Expo Notifications)
- [ ] Algoritmo de matching real
- [ ] Chat em tempo real (Firestore ou WebSocket)

---

## 🛡 Segurança

O Safimatch é um espaço exclusivo para mulheres com:
- Verificação de identidade em camadas
- Modo invisível (explorar sem aparecer)
- Sistema de denúncia e bloqueio
- Dados protegidos e nunca compartilhados

---

*Feito com 💜 — Safimatch v1.0.0*
