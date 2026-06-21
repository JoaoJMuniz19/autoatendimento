/* ============================================================
   JC-APK TV — Proteção das páginas administrativas
   Arquivo: dados/admin-gate.js

   Funções:
   - bloqueia completamente a página até validar a sessão;
   - permite acesso somente para profile.role = "admin";
   - impede usuário de teste ou cliente comum de acessar;
   - reaproveita uma sessão administrativa válida;
   - oferece login seguro sem guardar a senha;
   - dispara o evento "jc:admin-liberado" após a validação.
   ============================================================ */
(function () {
  "use strict";

  if (window.__JC_ADMIN_GATE_INITIALIZED__) return;
  window.__JC_ADMIN_GATE_INITIALIZED__ = true;

  const script = document.currentScript;
  const options = {
    title:
      (script && script.dataset && script.dataset.title) ||
      "Área administrativa",
    description:
      (script && script.dataset && script.dataset.description) ||
      "Somente administradores podem acessar esta página.",
    backUrl:
      (script && script.dataset && script.dataset.backUrl) || "index.html",
    backLabel:
      (script && script.dataset && script.dataset.backLabel) ||
      "← Voltar ao painel",
  };

  const A = window.JC_APP;
  const root = document.documentElement;
  const protectedNodes = [];
  let gate = null;
  let form = null;
  let identifierInput = null;
  let passwordInput = null;
  let submitButton = null;
  let retryButton = null;
  let messageBox = null;
  let checking = false;
  let unlocked = false;
  let authListener = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[char];
      },
    );
  }

  function injectFallbackStyles() {
    if (document.getElementById("jc-admin-gate-fallback-style")) return;

    const style = document.createElement("style");
    style.id = "jc-admin-gate-fallback-style";
    style.textContent = `
      html.jc-admin-checking body > :not(#jc-admin-gate) {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      #jc-admin-gate {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        padding: 20px;
        background:
          radial-gradient(circle at 20% 10%, rgba(31, 146, 255, .2), transparent 34%),
          radial-gradient(circle at 82% 82%, rgba(41, 211, 145, .14), transparent 32%),
          linear-gradient(145deg, #020814, #071a29 55%, #04101b);
        color: #f4f8fb;
        font-family: Arial, Helvetica, sans-serif;
      }
      #jc-admin-gate[hidden] { display: none !important; }
      .jc-admin-gate-card {
        width: min(470px, 100%);
        padding: 26px;
        border: 1px solid rgba(129, 189, 229, .25);
        border-radius: 24px;
        background: rgba(7, 25, 39, .96);
        box-shadow: 0 28px 90px rgba(0, 0, 0, .55);
      }
      .jc-admin-gate-brand {
        display: flex;
        align-items: center;
        gap: 13px;
        margin-bottom: 18px;
      }
      .jc-admin-gate-logo {
        display: grid;
        width: 52px;
        height: 52px;
        place-items: center;
        border-radius: 16px;
        background: linear-gradient(145deg, #1c91ff, #29d391);
        color: #03131e;
        font-size: 24px;
        font-weight: 1000;
      }
      .jc-admin-gate-card h1 {
        margin: 0;
        font-size: clamp(22px, 5vw, 30px);
      }
      .jc-admin-gate-card p {
        margin: 6px 0 0;
        color: #b9c9d3;
        line-height: 1.55;
      }
      .jc-admin-gate-status {
        margin: 16px 0;
        padding: 11px 12px;
        border: 1px solid rgba(129, 189, 229, .24);
        border-radius: 12px;
        background: rgba(255, 255, 255, .04);
        color: #c9d8e1;
        font-size: 13px;
        line-height: 1.45;
      }
      .jc-admin-gate-status.ok {
        border-color: rgba(41, 211, 145, .38);
        background: rgba(41, 211, 145, .1);
        color: #bff6df;
      }
      .jc-admin-gate-status.error {
        border-color: rgba(255, 91, 91, .42);
        background: rgba(255, 91, 91, .1);
        color: #ffd0d0;
      }
      .jc-admin-gate-field { margin-top: 13px; }
      .jc-admin-gate-field label {
        display: block;
        margin-bottom: 6px;
        color: #dce8ee;
        font-size: 13px;
        font-weight: 800;
      }
      .jc-admin-gate-field input {
        box-sizing: border-box;
        width: 100%;
        padding: 12px 13px;
        border: 1px solid rgba(129, 189, 229, .28);
        border-radius: 12px;
        outline: none;
        background: #07131f;
        color: #fff;
        font: inherit;
      }
      .jc-admin-gate-field input:focus {
        border-color: #1c91ff;
        box-shadow: 0 0 0 3px rgba(28, 145, 255, .14);
      }
      .jc-admin-gate-password {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
      }
      .jc-admin-gate-actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 9px;
        margin-top: 18px;
      }
      .jc-admin-gate-button,
      .jc-admin-gate-link {
        box-sizing: border-box;
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding: 11px 15px;
        border: 0;
        border-radius: 12px;
        cursor: pointer;
        text-decoration: none;
        font: inherit;
        font-weight: 900;
      }
      .jc-admin-gate-button.primary {
        background: linear-gradient(135deg, #1c91ff, #29d391);
        color: #03131e;
      }
      .jc-admin-gate-button.secondary,
      .jc-admin-gate-link {
        border: 1px solid rgba(129, 189, 229, .25);
        background: rgba(255, 255, 255, .05);
        color: #eaf4f9;
      }
      .jc-admin-gate-button:disabled {
        cursor: wait;
        opacity: .65;
      }
      .jc-admin-gate-password .jc-admin-gate-button {
        min-height: 0;
        padding: 8px 11px;
        font-size: 12px;
      }
      .jc-admin-gate-project {
        margin-top: 15px;
        color: #7891a1;
        font-size: 11px;
        text-align: center;
      }
      @media (max-width: 520px) {
        #jc-admin-gate { padding: 12px; }
        .jc-admin-gate-card { padding: 20px 16px; border-radius: 19px; }
      }
    `;
    document.head.appendChild(style);
  }

  function protectPage() {
    root.classList.add("jc-admin-checking");
    root.classList.remove("jc-admin-liberado");

    Array.from(document.body.children).forEach(function (node) {
      if (node.id === "jc-admin-gate") return;
      protectedNodes.push({
        node: node,
        inert: Boolean(node.inert),
        ariaHidden: node.getAttribute("aria-hidden"),
      });
      node.inert = true;
      node.setAttribute("aria-hidden", "true");
    });
  }

  function restoreProtectedPage() {
    protectedNodes.forEach(function (entry) {
      entry.node.inert = entry.inert;
      if (entry.ariaHidden == null) {
        entry.node.removeAttribute("aria-hidden");
      } else {
        entry.node.setAttribute("aria-hidden", entry.ariaHidden);
      }
    });
    protectedNodes.length = 0;
  }

  function createGate() {
    gate = document.createElement("section");
    gate.id = "jc-admin-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "jc-admin-gate-title");

    const projectId = String(
      (A && A.cfg && A.cfg.url) ||
        (window.JC_SUPABASE_CONFIG && window.JC_SUPABASE_CONFIG.url) ||
        "",
    )
      .replace(/^https:\/\//i, "")
      .replace(/\.supabase\.co.*$/i, "");

    gate.innerHTML = `
      <div class="jc-admin-gate-card">
        <div class="jc-admin-gate-brand">
          <div class="jc-admin-gate-logo" aria-hidden="true">JC</div>
          <div>
            <h1 id="jc-admin-gate-title">${escapeHtml(options.title)}</h1>
            <p>${escapeHtml(options.description)}</p>
          </div>
        </div>

        <div id="jc-admin-gate-message" class="jc-admin-gate-status" role="status" aria-live="polite">
          Verificando a sessão administrativa...
        </div>

        <form id="jc-admin-gate-form" autocomplete="on" hidden>
          <div class="jc-admin-gate-field">
            <label for="jc-admin-gate-identifier">Usuário ou e-mail do administrador</label>
            <input id="jc-admin-gate-identifier" name="username" autocomplete="username" required>
          </div>

          <div class="jc-admin-gate-field">
            <label for="jc-admin-gate-password">Senha</label>
            <div class="jc-admin-gate-password">
              <input id="jc-admin-gate-password" name="password" type="password" autocomplete="current-password" required>
              <button id="jc-admin-gate-toggle-password" class="jc-admin-gate-button secondary" type="button" aria-label="Mostrar senha">👁 Mostrar</button>
            </div>
          </div>

          <div class="jc-admin-gate-actions">
            <button id="jc-admin-gate-submit" class="jc-admin-gate-button primary" type="submit">Entrar como administrador</button>
            <button id="jc-admin-gate-retry" class="jc-admin-gate-button secondary" type="button">Verificar sessão novamente</button>
            <a class="jc-admin-gate-link" href="${escapeHtml(options.backUrl)}">${escapeHtml(options.backLabel)}</a>
          </div>
        </form>

        <div class="jc-admin-gate-project">Projeto Supabase: ${escapeHtml(projectId || "não identificado")}</div>
      </div>
    `;

    document.body.appendChild(gate);

    form = document.getElementById("jc-admin-gate-form");
    identifierInput = document.getElementById("jc-admin-gate-identifier");
    passwordInput = document.getElementById("jc-admin-gate-password");
    submitButton = document.getElementById("jc-admin-gate-submit");
    retryButton = document.getElementById("jc-admin-gate-retry");
    messageBox = document.getElementById("jc-admin-gate-message");

    form.addEventListener("submit", handleLogin);
    retryButton.addEventListener("click", function () {
      verifySession({ showLoginWhenMissing: true });
    });

    document
      .getElementById("jc-admin-gate-toggle-password")
      .addEventListener("click", function () {
        const visible = passwordInput.type === "text";
        passwordInput.type = visible ? "password" : "text";
        this.textContent = visible ? "👁 Mostrar" : "🙈 Ocultar";
        this.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
        passwordInput.focus();
      });
  }

  function setMessage(text, type) {
    if (!messageBox) return;
    messageBox.textContent = String(text || "");
    messageBox.className = "jc-admin-gate-status" + (type ? " " + type : "");
  }

  function showLogin(message, type) {
    if (unlocked || !form) return;
    form.hidden = false;
    setMessage(message || "Entre com uma conta administrativa.", type || "");
    window.setTimeout(function () {
      if (identifierInput) identifierInput.focus();
    }, 0);
  }

  function setBusy(active) {
    checking = active;
    if (submitButton) submitButton.disabled = active;
    if (retryButton) retryButton.disabled = active;
    if (identifierInput) identifierInput.disabled = active;
    if (passwordInput) passwordInput.disabled = active;
  }

  function adminAccessIsValid(access) {
    const profile = access && access.profile;
    return Boolean(
      profile &&
        String(profile.role || "").toLowerCase() === "admin" &&
        String(profile.status || "active").toLowerCase() === "active",
    );
  }

  function unlock(access) {
    if (unlocked) return;
    unlocked = true;
    checking = false;
    window.JC_ADMIN_ACCESS = access;

    restoreProtectedPage();
    root.classList.remove("jc-admin-checking");
    root.classList.add("jc-admin-liberado");

    if (gate) {
      gate.hidden = true;
      gate.setAttribute("aria-hidden", "true");
    }

    const detail = { access: access };
    document.dispatchEvent(
      new CustomEvent("jc:admin-liberado", { detail: detail }),
    );
    window.dispatchEvent(
      new CustomEvent("jc:admin-liberado", { detail: detail }),
    );
  }

  async function denyCurrentSession(message) {
    try {
      if (A && A.client) await A.client.auth.signOut();
    } catch (_error) {
      // A tela continua bloqueada mesmo se o encerramento remoto falhar.
    }
    showLogin(
      message || "Esta conta não possui permissão de administrador.",
      "error",
    );
  }

  async function verifySession(settings) {
    const config = settings || {};
    if (checking || unlocked) return;

    if (!A || !A.ready || !A.client) {
      showLogin(
        "O Supabase não está configurado corretamente. Confira dados/supabase-config.js.",
        "error",
      );
      return;
    }

    setBusy(true);
    setMessage("Verificando a sessão administrativa...", "");

    try {
      const sessionResult = await A.client.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;

      const session = sessionResult.data && sessionResult.data.session;
      if (!session) {
        if (config.showLoginWhenMissing !== false) {
          showLogin("Entre com sua conta administrativa para continuar.", "");
        }
        return;
      }

      const access = await A.myAccess();
      if (!adminAccessIsValid(access)) {
        await denyCurrentSession(
          "A sessão encontrada não é de um administrador ativo. Usuários de teste e clientes não podem acessar esta página.",
        );
        return;
      }

      setMessage("Acesso administrativo confirmado.", "ok");
      unlock(access);
    } catch (error) {
      const message =
        error && error.message
          ? error.message
          : "Não foi possível validar a sessão administrativa.";
      showLogin("Falha na validação: " + message, "error");
    } finally {
      if (!unlocked) setBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (checking || unlocked) return;

    const identifier = String(identifierInput.value || "").trim();
    const password = String(passwordInput.value || "");

    if (!identifier || !password) {
      setMessage("Digite o usuário ou e-mail e a senha.", "error");
      return;
    }

    setBusy(true);
    setMessage("Validando a conta administrativa...", "");

    try {
      await A.login(identifier, password);
      passwordInput.value = "";

      const access = await A.myAccess();
      if (!adminAccessIsValid(access)) {
        await denyCurrentSession(
          "Login realizado, mas esta conta não possui permissão de administrador ativo.",
        );
        return;
      }

      setMessage("Acesso administrativo confirmado.", "ok");
      unlock(access);
    } catch (error) {
      const raw = String((error && error.message) || error || "");
      const friendly = /invalid login credentials/i.test(raw)
        ? "Usuário/e-mail ou senha incorretos."
        : raw || "Não foi possível realizar o login.";
      setMessage(friendly, "error");
      passwordInput.value = "";
      passwordInput.focus();
    } finally {
      if (!unlocked) setBusy(false);
    }
  }

  function watchAuthentication() {
    if (!A || !A.client || !A.client.auth) return;

    const result = A.client.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT" && unlocked) {
        window.location.reload();
      }
    });

    authListener = result && result.data && result.data.subscription;
  }

  function initialize() {
    injectFallbackStyles();
    protectPage();
    createGate();
    watchAuthentication();
    verifySession({ showLoginWhenMissing: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.addEventListener(
    "pagehide",
    function () {
      if (authListener && typeof authListener.unsubscribe === "function") {
        authListener.unsubscribe();
      }
    },
    { once: true },
  );
})();
