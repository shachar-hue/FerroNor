/* FerroNor — Wireframe D3 Globe */
(function () {
  'use strict';

  const BRONZE      = '#B89A63';
  const LUANDA      = [13.23, -8.84];
  const LUANDA_ROT  = [-13.23, 8.84];
  const SPIN_SPEED  = 0.55;

  /* ── DOM ─────────────────────────────────────────── */
  const section = document.getElementById('globe-section');
  const canvas  = document.getElementById('globe-canvas');
  const textEl  = document.getElementById('globe-text');
  if (!section || !canvas || typeof d3 === 'undefined') return;

  /* ── Canvas / Projection ─────────────────────────── */
  let W, H, R, dpr, ctx, projection;
  let allDots = [], landData = null, angolaFeature = null;
  let europeFeatures = [], asiaFeatures = [], portugalFeature = null;
  let rotation        = [0, 0];
  let loaded          = false;
  let phase1Snap      = null;
  let phase1SpinDelta = 0;

  function setup() {
    W   = window.innerWidth;
    H   = window.innerHeight;
    R   = Math.min(W, H) / 2.5;
    dpr = window.devicePixelRatio || 1;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    projection = d3.geoOrthographic()
      .scale(R)
      .translate([W / 2, H / 2])
      .clipAngle(90);
  }

  /* ── Dot generation ──────────────────────────────── */
  function pip(pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      if ((yi > pt[1]) !== (yj > pt[1]) &&
          pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }
  function pif(pt, feat) {
    var g = feat.geometry;
    if (g.type === 'Polygon') {
      if (!pip(pt, g.coordinates[0])) return false;
      for (var i = 1; i < g.coordinates.length; i++)
        if (pip(pt, g.coordinates[i])) return false;
      return true;
    }
    if (g.type === 'MultiPolygon') {
      for (var k = 0; k < g.coordinates.length; k++) {
        var poly = g.coordinates[k];
        if (pip(pt, poly[0])) {
          var hole = false;
          for (var m = 1; m < poly.length; m++)
            if (pip(pt, poly[m])) { hole = true; break; }
          if (!hole) return true;
        }
      }
      return false;
    }
    return false;
  }
  function genDots(feat) {
    var dots = [];
    var b = d3.geoBounds(feat);
    var step = 14 * 0.08;
    for (var lng = b[0][0]; lng <= b[1][0]; lng += step)
      for (var lat = b[0][1]; lat <= b[1][1]; lat += step)
        if (pif([lng, lat], feat)) dots.push([lng, lat]);
    return dots;
  }

  /* ── Core draw ───────────────────────────────────── */
  function drawGlobe(rot, angolaProgress) {
    projection.scale(R).rotate(rot).translate([W / 2, H / 2]);
    var pg = d3.geoPath().projection(projection).context(ctx);

    ctx.clearRect(0, 0, W, H);

    /* ocean */
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, R, 0, 2 * Math.PI);
    ctx.fillStyle = '#090909';
    ctx.fill();
    ctx.strokeStyle = 'rgba(184,154,99,0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (!landData) return;

    /* graticule */
    ctx.beginPath();
    pg(d3.geoGraticule()());
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    /* countries (non-Angola) */
    ctx.beginPath();
    landData.features.forEach(function(f) { if (f !== angolaFeature) pg(f); });
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();

    /* Angola — glow scales with scroll progress */
    if (angolaFeature) {
      var glow = angolaProgress || 0;
      ctx.save();
      ctx.shadowColor = BRONZE;
      ctx.shadowBlur  = 6 + glow * 28;
      ctx.beginPath();
      pg(angolaFeature);
      ctx.strokeStyle = BRONZE;
      ctx.lineWidth   = 1.4 + glow * 1.4;
      ctx.stroke();
      ctx.fillStyle   = 'rgba(184,154,99,' + (0.08 + glow * 0.28) + ')';
      ctx.fill();
      ctx.restore();
    }

    /* Europe + Asia + Portugal — fade in with scroll progress */
    if (angolaProgress > 0) {
      var gp = angolaProgress;

      /* Europe glow */
      if (europeFeatures.length) {
        ctx.save();
        ctx.shadowColor = BRONZE;
        ctx.shadowBlur  = 4 + gp * 18;
        ctx.beginPath();
        europeFeatures.forEach(function(f) { pg(f); });
        ctx.strokeStyle = 'rgba(184,154,99,' + (gp * 0.55) + ')';
        ctx.lineWidth   = 0.8;
        ctx.stroke();
        ctx.fillStyle   = 'rgba(184,154,99,' + (gp * 0.09) + ')';
        ctx.fill();
        ctx.restore();
      }

      /* Asia glow */
      if (asiaFeatures.length) {
        ctx.save();
        ctx.shadowColor = BRONZE;
        ctx.shadowBlur  = 4 + gp * 14;
        ctx.beginPath();
        asiaFeatures.forEach(function(f) { pg(f); });
        ctx.strokeStyle = 'rgba(184,154,99,' + (gp * 0.45) + ')';
        ctx.lineWidth   = 0.8;
        ctx.stroke();
        ctx.fillStyle   = 'rgba(184,154,99,' + (gp * 0.07) + ')';
        ctx.fill();
        ctx.restore();
      }

      /* Continent labels */
      var europeLabel = projection([18, 54]);
      if (europeLabel) {
        ctx.save();
        ctx.font          = '300 11px Manrope, sans-serif';
        ctx.letterSpacing = '0.16em';
        ctx.shadowColor   = BRONZE;
        ctx.shadowBlur    = 10 * gp;
        ctx.fillStyle     = 'rgba(245,242,236,' + gp + ')';
        ctx.fillText('EUROPE', europeLabel[0] - 22, europeLabel[1]);
        ctx.restore();
      }

      var asiaLabel = projection([85, 48]);
      if (asiaLabel) {
        ctx.save();
        ctx.font          = '300 11px Manrope, sans-serif';
        ctx.letterSpacing = '0.16em';
        ctx.shadowColor   = BRONZE;
        ctx.shadowBlur    = 10 * gp;
        ctx.fillStyle     = 'rgba(245,242,236,' + gp + ')';
        ctx.fillText('ASIA', asiaLabel[0] - 14, asiaLabel[1]);
        ctx.restore();
      }

      /* Portugal dot */
      var ptPt = projection([-8.2, 39.4]);
      if (ptPt) {
        ctx.save();
        ctx.shadowColor = BRONZE;
        ctx.shadowBlur  = 4 + gp * 14;
        ctx.beginPath();
        ctx.arc(ptPt[0], ptPt[1], 2 + gp * 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = BRONZE;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(ptPt[0], ptPt[1], 7 + gp * 3, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(184,154,99,' + (0.25 + gp * 0.35) + ')';
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        if (gp > 0.2) {
          ctx.save();
          ctx.font          = '300 10px Manrope, sans-serif';
          ctx.letterSpacing = '0.1em';
          ctx.shadowColor   = BRONZE;
          ctx.shadowBlur    = 8 * gp;
          ctx.fillStyle     = 'rgba(245,242,236,' + Math.min((gp - 0.2) / 0.8, 1) + ')';
          ctx.fillText('PORTUGAL', ptPt[0] - 34, ptPt[1] - 10);
          ctx.restore();
        }
      }
    }

    /* dots */
    allDots.forEach(function(d) {
      var p = projection(d);
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.0, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();
    });

    /* Luanda dot + label — fades in with progress */
    var lp = projection(LUANDA);
    if (lp) {
      var glow2 = angolaProgress || 0;

      ctx.save();
      ctx.shadowColor = BRONZE;
      ctx.shadowBlur  = 4 + glow2 * 18;
      ctx.beginPath();
      ctx.arc(lp[0], lp[1], 3 + glow2 * 2, 0, 2 * Math.PI);
      ctx.fillStyle = BRONZE;
      ctx.fill();
      ctx.restore();

      /* outer ring */
      ctx.beginPath();
      ctx.arc(lp[0], lp[1], 8 + glow2 * 4, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(184,154,99,' + (0.3 + glow2 * 0.4) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      /* "LUANDA" label */
      if (glow2 > 0.05) {
        ctx.save();
        ctx.font        = '300 13px Manrope, sans-serif';
        ctx.shadowColor = BRONZE;
        ctx.shadowBlur  = 10 * glow2;
        ctx.fillStyle   = 'rgba(245,242,236,' + glow2 + ')';
        ctx.letterSpacing = '0.12em';
        ctx.fillText('LUANDA', lp[0] + 14, lp[1] - 6);
        ctx.restore();
      }
    }
  }

  /* ── Helpers ─────────────────────────────────────── */
  function eout(t) { return 1 - Math.pow(1 - t, 3); }  // cubic ease-out: fast start → slow stop
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── Render loop ─────────────────────────────────── */
  d3.timer(function () {
    if (!loaded) return;

    var rect  = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    var raw   = -rect.top / total;

    /* Before / at section top: slow auto-spin */
    if (raw <= 0) {
      phase1Snap      = null;
      phase1SpinDelta = 0;
      rotation[0]    += SPIN_SPEED;
      drawGlobe(rotation, 0);
      if (textEl) textEl.style.opacity = '1';
      return;
    }

    /* Inside or past section: spin fast then decelerate to Luanda.
       On first entry capture the starting angle and compute how far
       to travel — always going forward (same direction as auto-spin)
       plus 1.5 extra full revolutions so it visually looks like a
       fast spin before settling. */
    var prog = clamp(raw, 0, 1);
    if (!phase1Snap) {
      phase1Snap = [rotation[0], rotation[1]];
      var dx = LUANDA_ROT[0] - (phase1Snap[0] % 360);
      dx = ((dx % 360) + 360) % 360;          // normalise to [0, 360)
      phase1SpinDelta = dx + 1.5 * 360;       // 1.5 extra revolutions
    }

    var t = eout(prog);                        // fast at start → decelerates to stop
    rotation[0] = phase1Snap[0] + t * phase1SpinDelta;
    rotation[1] = lerp(phase1Snap[1], LUANDA_ROT[1], t);
    drawGlobe(rotation, t);

    if (textEl) textEl.style.opacity = String(clamp(1 - prog * 3, 0, 1));
  });

  /* ── Load data ───────────────────────────────────── */
  setup();

  Promise.all([
    fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/cultural/ne_110m_admin_0_countries.json').then(function(r) { return r.json(); }),
    fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json').then(function(r) { return r.json(); })
  ]).then(function(results) {
    var countries = results[0], land = results[1];
    landData = countries;
    angolaFeature = countries.features.find(function(f) {
      return f.properties && (
        f.properties.ISO_A3 === 'AGO' ||
        f.properties.ADM0_A3 === 'AGO' ||
        f.properties.NAME === 'Angola'
      );
    });
    europeFeatures = countries.features.filter(function(f) {
      return f.properties && f.properties.CONTINENT === 'Europe';
    });
    asiaFeatures = countries.features.filter(function(f) {
      return f.properties && f.properties.CONTINENT === 'Asia';
    });
    portugalFeature = countries.features.find(function(f) {
      return f.properties && (f.properties.ISO_A3 === 'PRT' || f.properties.NAME === 'Portugal');
    });
    land.features.forEach(function(f) {
      genDots(f).forEach(function(d) { allDots.push(d); });
    });
    loaded = true;
  }).catch(function(e) {
    console.warn('[Globe] load failed:', e);
    loaded = true;
  });

})();
