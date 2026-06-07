(function loadMoverConfig(global) {
  "use strict";

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function loadJsonSync(url, label) {
    const request = new XMLHttpRequest();
    request.open("GET", url, false);
    request.send();
    const ok = request.status >= 200 && request.status < 300;
    const fileOk = request.status === 0 && request.responseText;
    if (!ok && !fileOk) {
      throw new Error(`Falha ao carregar ${label} (HTTP ${request.status})`);
    }
    const parsed = JSON.parse(request.responseText);
    if (!isPlainObject(parsed)) {
      throw new Error(`${label} tem de ser um objeto JSON no topo`);
    }
    return parsed;
  }

  function loadConfigSync() {
    const appConfig = loadJsonSync(new URL("config.json", global.location.href).href, "config.json");
    const carrisZones = loadJsonSync(new URL("/config/carris-zones.json", global.location.href).href, "config/carris-zones.json");
    return { ...appConfig, ...carrisZones };
  }

  function buildRouteBaseSets(routeBases = {}) {
    if (!isPlainObject(routeBases)) return {};
    return Object.fromEntries(
      Object.entries(routeBases).map(([zone, routeList]) => [
        zone,
        new Set(Array.isArray(routeList) ? routeList.map((route) => String(route).trim()).filter(Boolean) : [])
      ])
    );
  }

  function buildCarrisHelpers(config = {}) {
    const zoneColorByName = Object.freeze({ ...(isPlainObject(config.zoneColorByName) ? config.zoneColorByName : {}) });
    const zoneRouteBases = buildRouteBaseSets(config.zoneRouteBases);

    function parseRouteCodeParts(routeIdOrName) {
      const raw = String(routeIdOrName ?? "").trim();
      if (!raw) return { code: "", codeBase: "" };
      const normalized = raw.toUpperCase();
      const leading = normalized.match(/^\s*([0-9]{1,3}[A-Z]?)(?=[^0-9A-Z]|$)/i);
      if (leading) {
        const code = leading[1].toUpperCase();
        const digits = code.match(/(\d{1,3})/);
        const codeBase = (/^\d{3}[01]$/.test(code)) ? code.slice(0, 3) : (digits ? digits[1] : code);
        return { code, codeBase };
      }
      const compact = normalized.replace(/[^A-Z0-9]/g, "");
      const match = compact.match(/(\d{1,3}[A-Z]?)/);
      const code = match ? match[1] : compact;
      const digits = code.match(/(\d{1,3})/);
      const codeBase = (/^\d{3}[01]$/.test(code)) ? code.slice(0, 3) : (digits ? digits[1] : code);
      return { code, codeBase };
    }

    function definirZona(routeIdOrName) {
      const { code, codeBase } = parseRouteCodeParts(routeIdOrName);
      if (!code && !codeBase) return "";
      if (code.endsWith("B")) return "Bairro";
      if (zoneRouteBases.Madrugada && zoneRouteBases.Madrugada.has(codeBase)) return "Madrugada";
      for (const [zone, routes] of Object.entries(zoneRouteBases)) {
        if (routes.has(code) || routes.has(codeBase)) return zone;
      }
      return "";
    }

    function getZoneColor(zoneName) {
      return zoneColorByName[zoneName] || null;
    }

    function getCategory(routeIdOrName) {
      const raw = String(routeIdOrName ?? "").trim().toUpperCase();
      if (!raw) return "Autocarros Diurnos";
      if (raw.endsWith("E")) return "Elétricos";
      if (raw.endsWith("B")) return "Carreiras de Bairro";
      const { codeBase } = parseRouteCodeParts(raw);
      if (/^2\d{2}$/.test(codeBase)) return "Rede Madrugada";
      return "Autocarros Diurnos";
    }

    function getPillStyle(routeIdOrName) {
      const zone = definirZona(routeIdOrName);
      const color = getZoneColor(zone);
      const category = getCategory(routeIdOrName);
      const bg = color || (
        category === "Carreiras de Bairro" ? "#c084fc" :
        category === "Elétricos" ? "#f39c12" :
        category === "Rede Madrugada" ? "#3498db" :
        "#2ecc71"
      );
      const fg = color ? (zone === "Bairro" ? "#0b1220" : "#ffffff") : "#0b1220";
      const border = color || "rgba(15, 23, 42, 0.12)";
      const title = zone || category || "Carreira";
      return { bg, fg, border, title, zone: zone || null, category };
    }

    return deepFreeze({
      zoneColorByName,
      zoneRouteBases,
      parseRouteCodeParts,
      definirZona,
      getZoneColor,
      getCategory,
      getPillStyle,
    });
  }

  global.MOVER_CONFIG = deepFreeze(loadConfigSync());
  global.buildMoverRouteBaseSets = buildRouteBaseSets;
  global.buildMoverCarrisHelpers = buildCarrisHelpers;
  global.MOVER_CARRIS = buildCarrisHelpers(global.MOVER_CONFIG);
})(window);
