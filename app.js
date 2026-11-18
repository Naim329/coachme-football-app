document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const KEY = "coachMeJour30";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);

  const dateLabel = value => {
    if (!value) return "Date non définie";
    const d = new Date(value + "T12:00:00");
    return Number.isNaN(d.getTime()) ? "Date non définie" :
      d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const blankData = () => ({
    teams: [], players: [], sessions: [], exercises: [], goals: [], matches: []
  });

  let data = blankData();
  let editingSession = null;
  let editingMatch = null;
  let selectedDate = today();
  let monthCursor = new Date();

  function notify(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => el.classList.remove("show"), 2500);
  }

  function normalize(raw) {
    const result = blankData();
    ["teams", "players", "sessions", "exercises", "goals", "matches"].forEach(k => {
      if (Array.isArray(raw[k])) result[k] = raw[k];
    });

    result.teams = result.teams.map(t => ({
      ...t, id: t.id || id(), name: t.name || "Mon équipe",
      category: t.category || "Autre", color: t.color || "#2684ff"
    }));

    if (!result.teams.length) {
      result.teams.push({
        id: "team-default", name: "Mon équipe",
        category: "Équipe principale", color: "#2684ff"
      });
    }

    const firstTeam = result.teams[0].id;

    result.players = result.players.map(p => ({
      ...p, id: p.id || id(), teamId: p.teamId || firstTeam
    }));

    result.sessions = result.sessions.map(s => ({
      ...s,
      id: s.id || id(),
      teamId: s.teamId || firstTeam,
      status: s.status || "planned",
      presentIds: Array.isArray(s.presentIds) ? s.presentIds : [],
      exercises: Array.isArray(s.exercises) ? s.exercises : [],
      notes: s.notes || ""
    }));

    result.exercises = result.exercises.map(e => ({ ...e, id: e.id || id() }));
    result.goals = result.goals.map(g => ({
      ...g, id: g.id || id(), progress: Number(g.progress) || 0,
      target: Math.max(1, Number(g.target) || 1)
    }));
    result.matches = result.matches.map(m => ({
      ...m, id: m.id || id(), teamId: m.teamId || firstTeam
    }));

    result.players.forEach(p => {
      if (!result.teams.some(t => t.id === p.teamId)) p.teamId = firstTeam;
    });
    result.sessions.forEach(s => {
      if (!result.teams.some(t => t.id === s.teamId)) s.teamId = firstTeam;
    });
    result.matches.forEach(m => {
      if (!result.teams.some(t => t.id === m.teamId)) m.teamId = firstTeam;
    });

    return result;
  }

  function load() {
    try {
      let saved = localStorage.getItem(KEY);
      if (!saved) {
        saved = localStorage.getItem("footSessionJour25")
          || localStorage.getItem("footSessionJour20")
          || localStorage.getItem("footSessionJour15")
          || localStorage.getItem("footSessionSessions");
      }
      if (saved) data = normalize(JSON.parse(saved));
      else data = normalize(blankData());
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      console.error(error);
      data = normalize(blankData());
      notify("Erreur lors du chargement des données.");
    }
  }

  function save(message) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      renderAll();
      if (message) notify(message);
    } catch (error) {
      console.error(error);
      notify("Impossible de sauvegarder les données.");
    }
  }

  function teamName(teamId) {
    return data.teams.find(t => t.id === teamId)?.name || "Équipe inconnue";
  }

  function statusText(status) {
    return ({
      planned: "À venir",
      completed: "Terminée",
      cancelled: "Annulée"
    })[status] || "À venir";
  }

  function fillSelect(selector, includeAll = false) {
    const el = $(selector);
    if (!el) return;
    const old = el.value;
    const allOption = includeAll ? '<option value="all">Toutes les équipes</option>' : "";
    el.innerHTML = allOption + data.teams.map(t =>
      `<option value="${safe(t.id)}">${safe(t.name)} (${safe(t.category)})</option>`
    ).join("");
    if ([...el.options].some(o => o.value === old)) el.value = old;
  }

  function refreshSelects() {
    fillSelect("#playerTeam");
    fillSelect("#sessionTeam");
    fillSelect("#matchTeam");
    fillSelect("#sessionTeamFilter", true);

    const goalPlayer = $("#goalPlayer");
    const old = goalPlayer.value;
    goalPlayer.innerHTML = data.players.map(p =>
      `<option value="${safe(p.id)}">${safe(p.name)} — ${safe(teamName(p.teamId))}</option>`
    ).join("");
    if ([...goalPlayer.options].some(o => o.value === old)) goalPlayer.value = old;
  }

  // Navigation
  const titles = {
    dashboard: "Tableau de bord", sessions: "Entraînements",
    calendar: "Calendrier", matches: "Matchs", players: "Joueurs",
    teams: "Équipes", exercises: "Exercices", goals: "Objectifs"
  };

  function navigate(page) {
    if (!titles[page]) return;
    $$(".page").forEach(p => p.classList.toggle("active", p.id === page));
    $$(".nav[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    $("#pageTitle").textContent = titles[page];
    $("#sidebar").classList.remove("open");
    if (page === "calendar") renderCalendar();
  }

  $$(".nav[data-page]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.page)));
  $$("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#todayText").textContent = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  // Modèles d'entraînement
  const templates = {
    warmup: {
      name: "Échauffement collectif", objective: "Physique", duration: 30,
      description: "Préparer les joueurs à l'entraînement.",
      exercises: "Course légère | 5 | Courir tranquillement | Aucun\nMobilité articulaire | 5 | Mobiliser les articulations | Aucun\nConduite de balle | 10 | Conduire dans une zone | Ballons et plots\nPasses en mouvement | 10 | Enchaîner les passes | Ballons"
    },
    passing: {
      name: "Travail des passes", objective: "Technique", duration: 45,
      description: "Améliorer la précision et la qualité des passes.",
      exercises: "Passes en binôme | 10 | Utiliser les deux pieds | Ballons\nPasses en triangle | 15 | Passer et se déplacer | Ballons et plots\nConservation 4 contre 2 | 20 | Garder le ballon | Chasubles"
    },
    possession: {
      name: "Conservation collective", objective: "Tactique", duration: 60,
      description: "Améliorer les déplacements et les solutions de passe.",
      exercises: "Rondo | 15 | Conserver le ballon | Ballons\nConservation 5 contre 5 | 20 | Chercher les solutions | Chasubles\nJeu de position | 25 | Utiliser largeur et profondeur | Plots"
    },
    finishing: {
      name: "Travail de finition", objective: "Offensif", duration: 50,
      description: "Améliorer la précision devant le but.",
      exercises: "Finition après conduite | 15 | Conduire puis frapper | Ballons\nFinition après centre | 15 | Attaquer la surface | Ballons\nDuel face au gardien | 20 | Choisir sa finition | Ballons et buts"
    }
  };

  // Entraînements
  const sessionModal = $("#sessionModal");
  const sessionForm = $("#sessionForm");

  function openSession(session = null, date = "") {
    editingSession = session?.id || null;
    sessionForm.reset();

    $("#sessionModalTitle").textContent = session ? "Modifier la séance" : "Nouvelle séance";
    $("#sessionName").value = session?.name || "";
    $("#sessionDate").value = session?.date || date || today();
    $("#sessionTeam").value = session?.teamId || data.teams[0]?.id || "";
    $("#sessionObjective").value = session?.objective || "Technique";
    $("#sessionDuration").value = session?.duration || 60;
    $("#sessionStatus").value = session?.status || "planned";
    $("#sessionDescription").value = session?.description || "";
    $("#sessionExercises").value = session?.exercisesText || "";
    $("#sessionNotes").value = session?.notes || "";
    $("#sessionRating").value = session?.rating || "";

    const players = data.players.filter(p => p.teamId === $("#sessionTeam").value);
    const present = session?.presentIds || [];
    $("#attendanceList").innerHTML = players.length ? players.map(p => `
      <label class="attendance-item">
        <input type="checkbox" value="${safe(p.id)}" ${session ? (present.includes(p.id) ? "checked" : "") : "checked"}>
        <span>${safe(p.name)}${p.number ? " · #" + safe(p.number) : ""}</span>
      </label>
    `).join("") : '<div class="empty-state">Aucun joueur dans cette équipe.</div>';

    sessionModal.classList.remove("hidden");
  }

  function closeSession() {
    sessionModal.classList.add("hidden");
    editingSession = null;
  }

  $("#newSession").addEventListener("click", () => openSession());
  $("#quickSession").addEventListener("click", () => openSession());
  $("#calendarAdd").addEventListener("click", () => openSession(null, selectedDate));
  $$('[data-close="session"]').forEach(b => b.addEventListener("click", closeSession));

  $("#sessionTeam").addEventListener("change", () => {
    const players = data.players.filter(p => p.teamId === $("#sessionTeam").value);
    $("#attendanceList").innerHTML = players.length ? players.map(p => `
      <label class="attendance-item"><input type="checkbox" value="${safe(p.id)}" checked><span>${safe(p.name)}</span></label>
    `).join("") : '<div class="empty-state">Aucun joueur dans cette équipe.</div>';
  });

  $$("[data-template]").forEach(b => b.addEventListener("click", () => {
    const t = templates[b.dataset.template];
    if (!t) return;
    $("#sessionName").value = t.name;
    $("#sessionObjective").value = t.objective;
    $("#sessionDuration").value = t.duration;
    $("#sessionDescription").value = t.description;
    $("#sessionExercises").value = t.exercises;
    notify("Modèle ajouté.");
  }));

  sessionForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#sessionName").value.trim();
    const date = $("#sessionDate").value;
    const duration = Number($("#sessionDuration").value);
    if (!name || !date || !Number.isFinite(duration) || duration < 1) {
      notify("Vérifie le nom, la date et la durée.");
      return;
    }

    const previous = data.sessions.find(s => s.id === editingSession);
    const exercisesText = $("#sessionExercises").value.trim();
    const exercises = exercisesText.split("\n").filter(Boolean).map(line => {
      const parts = line.split("|").map(x => x.trim());
      return {
        name: parts[0] || "Exercice",
        duration: Number(parts[1]) || 0,
        instructions: parts[2] || "",
        equipment: parts[3] || ""
      };
    });

    const session = {
      ...previous,
      id: editingSession || id(),
      name, date, duration,
      teamId: $("#sessionTeam").value,
      objective: $("#sessionObjective").value,
      status: $("#sessionStatus").value,
      description: $("#sessionDescription").value.trim(),
      exercisesText, exercises,
      presentIds: $$("#attendanceList input:checked").map(x => x.value),
      attendanceTracked: true,
      notes: $("#sessionNotes").value.trim(),
      rating: $("#sessionRating").value,
      createdAt: previous?.createdAt || new Date().toISOString()
    };

    if (editingSession) data.sessions = data.sessions.map(s => s.id === editingSession ? session : s);
    else data.sessions.push(session);

    save(editingSession ? "Séance modifiée." : "Séance créée.");
    closeSession();
  });

  function renderSessions() {
    const q = $("#sessionSearch").value.toLowerCase();
    const status = $("#sessionStatusFilter").value;
    const team = $("#sessionTeamFilter").value;

    const list = data.sessions.filter(s => {
      const searchable = [s.name, s.description, s.objective, teamName(s.teamId)].join(" ").toLowerCase();
      return searchable.includes(q)
        && (status === "all" || s.status === status)
        && (team === "all" || s.teamId === team);
    }).sort((a,b) => (b.date || "").localeCompare(a.date || ""));

    $("#sessionList").innerHTML = list.length ? list.map(s => {
      const totalPlayers = data.players.filter(p => p.teamId === s.teamId).length;
      const attendance = s.attendanceTracked
        ? `${(s.presentIds || []).length}/${totalPlayers} présents`
        : "Présences non renseignées";

      return `
        <article class="session-card">
          <div class="card-top"><h3>${safe(s.name)}</h3><span class="pill ${safe(s.status)}">${statusText(s.status)}</span></div>
          <div class="card-meta">📅 ${dateLabel(s.date)}<br>♧ ${safe(teamName(s.teamId))}<br>🎯 ${safe(s.objective || "—")} · ⏱ ${Number(s.duration) || 0} min<br>♙ ${attendance}</div>
          <p class="card-description">${safe(s.description || "Pas de description.")}</p>
          ${s.notes ? `<p class="card-description"><strong>Bilan :</strong> ${safe(s.notes)}</p>` : ""}
          <div class="card-actions">
            <button class="small-btn" data-edit-session="${s.id}">Modifier</button>
            <button class="small-btn" data-duplicate-session="${s.id}">Dupliquer</button>
            <button class="small-btn" data-complete-session="${s.id}">✓ Terminée</button>
            <button class="small-btn danger" data-delete-session="${s.id}">Supprimer</button>
          </div>
        </article>`;
    }).join("") : '<div class="empty-state">Aucune séance trouvée.</div>';
  }

  $("#sessionSearch").addEventListener("input", renderSessions);
  $("#sessionStatusFilter").addEventListener("change", renderSessions);
  $("#sessionTeamFilter").addEventListener("change", renderSessions);

  $("#sessionList").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    const s = data.sessions.find(x => x.id === Object.values(b.dataset)[0]);
    if (!s) return;

    if (b.hasAttribute("data-edit-session")) openSession(s);
    if (b.hasAttribute("data-duplicate-session")) {
      data.sessions.push({ ...s, id: id(), name: s.name + " (copie)", status: "planned", notes: "" });
      save("Séance dupliquée.");
    }
    if (b.hasAttribute("data-complete-session")) {
      s.status = "completed";
      save("Séance terminée.");
    }
    if (b.hasAttribute("data-delete-session") && confirm("Supprimer cette séance ?")) {
      data.sessions = data.sessions.filter(x => x.id !== s.id);
      save("Séance supprimée.");
    }
  });

  // Calendrier
  function renderCalendar() {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    $("#calendarMonth").textContent = new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    $("#selectedDateTitle").textContent = "Séances du " + dateLabel(selectedDate);

    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const previousDays = new Date(year, month, 0).getDate();
    const weekdays = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    let html = weekdays.map(d => `<div class="calendar-weekday">${d}</div>`).join("");

    for (let i = 0; i < 42; i++) {
      let d, currentMonth = true;
      if (i < firstDay) { d = new Date(year, month - 1, previousDays - firstDay + i + 1); currentMonth = false; }
      else if (i >= firstDay + days) { d = new Date(year, month + 1, i - firstDay - days + 1); currentMonth = false; }
      else d = new Date(year, month, i - firstDay + 1);

      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10);
      const count = data.sessions.filter(s => s.date === iso).length;
      html += `<button class="calendar-day ${currentMonth ? "" : "muted"} ${iso === selectedDate ? "selected" : ""} ${iso === today() ? "today" : ""}" data-day="${iso}">
        <span class="day-number">${d.getDate()}</span>${count ? `<span class="day-count">${count} séance(s)</span>` : ""}
      </button>`;
    }

    $("#calendarGrid").innerHTML = html;
    const sessions = data.sessions.filter(s => s.date === selectedDate);
    $("#selectedDayList").innerHTML = sessions.length ? sessions.map(s => `
      <div class="upcoming-item"><div><strong>${safe(s.name)}</strong><small>${safe(teamName(s.teamId))} · ${s.duration} min</small></div><button class="small-btn" data-open-calendar-session="${s.id}">Ouvrir</button></div>
    `).join("") : '<div class="empty-state">Aucune séance prévue à cette date.</div>';
  }

  $("#calendarGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    selectedDate = b.dataset.day;
    const d = new Date(selectedDate + "T12:00:00");
    monthCursor = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
  });

  $("#selectedDayList").addEventListener("click", e => {
    const b = e.target.closest("[data-open-calendar-session]");
    if (!b) return;
    const s = data.sessions.find(x => x.id === b.dataset.openCalendarSession);
    if (s) openSession(s);
  });

  $("#prevMonth").addEventListener("click", () => { monthCursor.setMonth(monthCursor.getMonth() - 1); renderCalendar(); });
  $("#nextMonth").addEventListener("click", () => { monthCursor.setMonth(monthCursor.getMonth() + 1); renderCalendar(); });
  $("#calendarToday").addEventListener("click", () => { monthCursor = new Date(); selectedDate = today(); renderCalendar(); });

  // Équipes
  $("#teamForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#teamName").value.trim();
    if (!name) return;
    if (data.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      notify("Cette équipe existe déjà.");
      return;
    }
    data.teams.push({
      id: id(), name, category: $("#teamCategory").value,
      color: $("#teamColor").value
    });
    e.target.reset();
    $("#teamColor").value = "#2684ff";
    save("Équipe créée.");
  });

  function renderTeams() {
    $("#teamList").innerHTML = data.teams.length ? data.teams.map(t => `
      <article class="team-card">
        <h3><span class="team-color" style="background:${safe(t.color)}"></span>${safe(t.name)}</h3>
        <p class="card-meta">${safe(t.category)} · ${data.players.filter(p => p.teamId === t.id).length} joueur(s) · ${data.sessions.filter(s => s.teamId === t.id).length} séance(s)</p>
        <div class="card-actions"><button class="small-btn" data-rename-team="${t.id}">Renommer</button><button class="small-btn danger" data-delete-team="${t.id}">Supprimer</button></div>
      </article>
    `).join("") : '<div class="empty-state">Aucune équipe enregistrée.</div>';
  }

  $("#teamList").addEventListener("click", e => {
    const rename = e.target.closest("[data-rename-team]");
    const del = e.target.closest("[data-delete-team]");

    if (rename) {
      const t = data.teams.find(x => x.id === rename.dataset.renameTeam);
      if (!t) return;
      const value = prompt("Nouveau nom :", t.name);
      if (value?.trim()) { t.name = value.trim(); save("Équipe renommée."); }
    }

    if (del) {
      if (data.teams.length <= 1) return notify("Garde au moins une équipe.");
      const team = data.teams.find(t => t.id === del.dataset.deleteTeam);
      if (!team || !confirm("Supprimer cette équipe ?")) return;
      const fallback = data.teams.find(t => t.id !== team.id).id;
      data.players.forEach(p => { if (p.teamId === team.id) p.teamId = fallback; });
      data.sessions.forEach(s => { if (s.teamId === team.id) s.teamId = fallback; });
      data.matches.forEach(m => { if (m.teamId === team.id) m.teamId = fallback; });
      data.teams = data.teams.filter(t => t.id !== team.id);
      save("Équipe supprimée.");
    }
  });

  // Joueurs et profils
  $("#playerForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#playerName").value.trim();
    const number = $("#playerNumber").value ? Number($("#playerNumber").value) : null;
    const teamId = $("#playerTeam").value;
    if (!name || !teamId) return notify("Complète le nom et l'équipe.");
    if (number !== null && (number < 1 || number > 99 || !Number.isInteger(number))) return notify("Numéro invalide.");
    if (number !== null && data.players.some(p => p.teamId === teamId && Number(p.number) === number)) return notify("Numéro déjà utilisé dans cette équipe.");

    data.players.push({
      id: id(), name, number, teamId,
      position: $("#playerPosition").value
    });
    e.target.reset();
    save("Joueur ajouté.");
  });

  function playerAttendance(playerId) {
    const relevant = data.sessions.filter(s =>
      s.status === "completed" && s.attendanceTracked &&
      data.players.some(p => p.id === playerId && p.teamId === s.teamId)
    );
    const present = relevant.filter(s => (s.presentIds || []).includes(playerId)).length;
    return { present, total: relevant.length, rate: relevant.length ? Math.round(present / relevant.length * 100) : null };
  }

  function renderPlayers() {
    const q = $("#playerSearch").value.toLowerCase();
    const players = data.players.filter(p => [p.name,p.position,teamName(p.teamId)].join(" ").toLowerCase().includes(q));

    $("#playerList").innerHTML = players.length ? players.map(p => {
      const initials = p.name.split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase();
      const stats = playerAttendance(p.id);
      return `
        <article class="player-card">
          <div class="player-avatar">${safe(initials)}</div>
          <div class="player-info"><strong>${safe(p.name)}</strong><small>${p.number ? "#" + p.number + " · " : ""}${safe(p.position)} · ${safe(teamName(p.teamId))}</small><small>${stats.rate === null ? "Statistiques à venir" : stats.rate + "% de présence"}</small></div>
          <button class="small-btn" data-profile="${p.id}">Profil</button>
          <button class="small-btn danger" data-remove-player="${p.id}">×</button>
        </article>`;
    }).join("") : '<div class="empty-state">Aucun joueur trouvé.</div>';
  }

  $("#playerSearch").addEventListener("input", renderPlayers);

  $("#playerList").addEventListener("click", e => {
    const profile = e.target.closest("[data-profile]");
    const remove = e.target.closest("[data-remove-player]");

    if (profile) openProfile(profile.dataset.profile);
    if (remove && confirm("Retirer ce joueur de l'effectif ?")) {
      const playerId = remove.dataset.removePlayer;
      data.players = data.players.filter(p => p.id !== playerId);
      data.goals = data.goals.filter(g => g.playerId !== playerId);
      data.sessions.forEach(s => { s.presentIds = (s.presentIds || []).filter(x => x !== playerId); });
      save("Joueur retiré.");
    }
  });

  function openProfile(playerId) {
    const p = data.players.find(x => x.id === playerId);
    if (!p) return;
    const stats = playerAttendance(playerId);
    const goals = data.goals.filter(g => g.playerId === playerId);
    $("#profileTitle").textContent = p.name;
    $("#profileContent").innerHTML = `
      <p class="card-meta">${p.number ? "#" + p.number + " · " : ""}${safe(p.position)} · ${safe(teamName(p.teamId))}</p>
      <div class="profile-stat-grid">
        <div class="profile-stat"><strong>${stats.rate === null ? "—" : stats.rate + "%"}</strong><small>Présence</small></div>
        <div class="profile-stat"><strong>${stats.present}</strong><small>Présences</small></div>
        <div class="profile-stat"><strong>${goals.length}</strong><small>Objectifs</small></div>
      </div>
      <h3>Objectifs du joueur</h3>
      ${goals.length ? goals.map(g => `<div class="goal-card"><strong>${safe(g.name)}</strong><p>${g.progress} / ${g.target}</p><div class="goal-track"><span style="width:${Math.min(100,g.progress/g.target*100)}%"></span></div></div>`).join("") : '<div class="empty-state">Aucun objectif pour ce joueur.</div>'}
    `;
    $("#profileModal").classList.remove("hidden");
  }

  $$('[data-close="profile"]').forEach(b => b.addEventListener("click", () => $("#profileModal").classList.add("hidden")));
  $("#profileModal").addEventListener("click", e => { if (e.target.id === "profileModal") e.target.classList.add("hidden"); });

  // Exercices
  $("#exerciseForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#exerciseName").value.trim();
    const duration = Number($("#exerciseDuration").value);
    if (!name || duration < 1) return notify("Vérifie le nom et la durée.");
    data.exercises.push({
      id: id(), name, duration,
      category: $("#exerciseCategory").value,
      equipment: $("#exerciseEquipment").value.trim(),
      instructions: $("#exerciseInstructions").value.trim()
    });
    e.target.reset();
    $("#exerciseDuration").value = 10;
    save("Exercice ajouté.");
  });

  function renderExercises() {
    const q = $("#exerciseSearch").value.toLowerCase();
    const list = data.exercises.filter(x => [x.name,x.category,x.equipment,x.instructions].join(" ").toLowerCase().includes(q));
    $("#exerciseList").innerHTML = list.length ? list.map(x => `
      <article class="exercise-card">
        <span class="pill planned">${safe(x.category)}</span>
        <h3>${safe(x.name)}</h3>
        <p class="card-meta">${x.duration} min · ${safe(x.equipment || "Matériel non précisé")}</p>
        <p class="card-description">${safe(x.instructions || "Aucune consigne.")}</p>
        <button class="small-btn danger" data-delete-exercise="${x.id}">Supprimer</button>
      </article>
    `).join("") : '<div class="empty-state">Aucun exercice trouvé.</div>';
  }

  $("#exerciseSearch").addEventListener("input", renderExercises);
  $("#exerciseList").addEventListener("click", e => {
    const b = e.target.closest("[data-delete-exercise]");
    if (!b || !confirm("Supprimer cet exercice ?")) return;
    data.exercises = data.exercises.filter(x => x.id !== b.dataset.deleteExercise);
    save("Exercice supprimé.");
  });

  // Objectifs
  $("#goalForm").addEventListener("submit", e => {
    e.preventDefault();
    const playerId = $("#goalPlayer").value;
    const name = $("#goalName").value.trim();
    const progress = Number($("#goalProgress").value);
    const target = Number($("#goalTarget").value);
    if (!playerId || !name || target < 1 || progress < 0) return notify("Vérifie les informations de l'objectif.");

    data.goals.push({ id: id(), playerId, name, progress: Math.min(progress,target), target });
    e.target.reset();
    $("#goalProgress").value = 0;
    $("#goalTarget").value = 10;
    save("Objectif ajouté.");
  });

  function renderGoals() {
    $("#goalList").innerHTML = data.goals.length ? data.goals.map(g => {
      const player = data.players.find(p => p.id === g.playerId);
      const percent = Math.min(100, Math.round(g.progress / g.target * 100));
      return `
        <article class="goal-card">
          <h3>${safe(g.name)}</h3>
          <p>${safe(player?.name || "Joueur")} · ${safe(teamName(player?.teamId))}</p>
          <div class="overview-row"><span>Progression</span><strong>${percent}%</strong></div>
          <div class="goal-track"><span style="width:${percent}%"></span></div>
          <p>${g.progress} / ${g.target}</p>
          <div class="card-actions"><button class="small-btn" data-goal-plus="${g.id}">+1 progrès</button><button class="small-btn danger" data-goal-delete="${g.id}">Supprimer</button></div>
        </article>`;
    }).join("") : '<div class="empty-state">Aucun objectif enregistré.</div>';
  }

  $("#goalList").addEventListener("click", e => {
    const plus = e.target.closest("[data-goal-plus]");
    const del = e.target.closest("[data-goal-delete]");
    if (plus) {
      const g = data.goals.find(x => x.id === plus.dataset.goalPlus);
      if (g) g.progress = Math.min(g.target, g.progress + 1);
      save("Progression mise à jour.");
    }
    if (del) {
      data.goals = data.goals.filter(g => g.id !== del.dataset.goalDelete);
      save("Objectif supprimé.");
    }
  });

  // Matchs
  const matchModal = $("#matchModal");
  const matchForm = $("#matchForm");

  function openMatch(match = null) {
    editingMatch = match?.id || null;
    matchForm.reset();
    $("#matchModalTitle").textContent = match ? "Modifier le match" : "Ajouter un match";
    $("#opponent").value = match?.opponent || "";
    $("#matchDate").value = match?.date || today();
    $("#matchTeam").value = match?.teamId || data.teams[0]?.id || "";
    $("#matchVenue").value = match?.venue || "Domicile";
    $("#ourScore").value = match?.ourScore ?? 0;
    $("#theirScore").value = match?.theirScore ?? 0;
    $("#matchNotes").value = match?.notes || "";
    matchModal.classList.remove("hidden");
  }

  function closeMatch() {
    matchModal.classList.add("hidden");
    editingMatch = null;
  }

  $("#newMatch").addEventListener("click", () => openMatch());
  $$('[data-close="match"]').forEach(b => b.addEventListener("click", closeMatch));

  matchForm.addEventListener("submit", e => {
    e.preventDefault();
    const opponent = $("#opponent").value.trim();
    const ourScore = Number($("#ourScore").value);
    const theirScore = Number($("#theirScore").value);
    if (!opponent || ourScore < 0 || theirScore < 0) return notify("Vérifie les informations du match.");

    const previous = data.matches.find(m => m.id === editingMatch);
    const match = {
      ...previous,
      id: editingMatch || id(),
      opponent,
      date: $("#matchDate").value,
      teamId: $("#matchTeam").value,
      venue: $("#matchVenue").value,
      ourScore, theirScore,
      notes: $("#matchNotes").value.trim()
    };

    if (editingMatch) data.matches = data.matches.map(m => m.id === editingMatch ? match : m);
    else data.matches.push(match);

    save(editingMatch ? "Match modifié." : "Match enregistré.");
    closeMatch();
  });

  function matchOutcome(m) {
    if (m.ourScore > m.theirScore) return "win";
    if (m.ourScore < m.theirScore) return "loss";
    return "draw";
  }

  function renderMatches() {
    const played = data.matches;
    const wins = played.filter(m => matchOutcome(m) === "win").length;
    const draws = played.filter(m => matchOutcome(m) === "draw").length;
    const losses = played.filter(m => matchOutcome(m) === "loss").length;

    $("#matchPlayed").textContent = played.length;
    $("#matchWins").textContent = wins;
    $("#matchDraws").textContent = draws;
    $("#matchLosses").textContent = losses;

    const sorted = [...played].sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    $("#matchList").innerHTML = sorted.length ? sorted.map(m => {
      const outcome = matchOutcome(m);
      const label = outcome === "win" ? "VICTOIRE" : outcome === "loss" ? "DÉFAITE" : "MATCH NUL";
      return `
        <article class="session-card">
          <div class="card-top"><h3>${safe(teamName(m.teamId))} vs ${safe(m.opponent)}</h3><span class="match-result ${outcome}">${label}</span></div>
          <div class="card-meta">${dateLabel(m.date)} · ${safe(m.venue)}</div>
          <div class="match-score">${m.ourScore} — ${m.theirScore}</div>
          ${m.notes ? `<p class="card-description">${safe(m.notes)}</p>` : ""}
          <div class="card-actions"><button class="small-btn" data-edit-match="${m.id}">Modifier</button><button class="small-btn danger" data-delete-match="${m.id}">Supprimer</button></div>
        </article>`;
    }).join("") : '<div class="empty-state">Aucun match enregistré. Ajoute ta première rencontre.</div>';
  }

  $("#matchList").addEventListener("click", e => {
    const edit = e.target.closest("[data-edit-match]");
    const del = e.target.closest("[data-delete-match]");
    if (edit) {
      const m = data.matches.find(x => x.id === edit.dataset.editMatch);
      if (m) openMatch(m);
    }
    if (del && confirm("Supprimer ce match ?")) {
      data.matches = data.matches.filter(m => m.id !== del.dataset.deleteMatch);
      save("Match supprimé.");
    }
  });

  // Tableau de bord
  function renderDashboard() {
    const completed = data.sessions.filter(s => s.status === "completed");
    $("#statSessions").textContent = data.sessions.length;
    $("#statCompleted").textContent = completed.length;
    $("#statPlayers").textContent = data.players.length;
    $("#statMatches").textContent = data.matches.length;

    const upcoming = data.sessions.filter(s => s.status === "planned" && s.date >= today())
      .sort((a,b) => a.date.localeCompare(b.date)).slice(0,5);

    $("#upcomingList").innerHTML = upcoming.length ? upcoming.map(s => `
      <div class="upcoming-item"><div><strong>${safe(s.name)}</strong><small>${dateLabel(s.date)} · ${safe(teamName(s.teamId))}</small></div><span class="pill planned">${s.duration} min</span></div>
    `).join("") : '<div class="empty-state">Aucun entraînement à venir.</div>';

    const wins = data.matches.filter(m => matchOutcome(m) === "win").length;
    const draws = data.matches.filter(m => matchOutcome(m) === "draw").length;
    const losses = data.matches.filter(m => matchOutcome(m) === "loss").length;
    $("#matchSummary").innerHTML = data.matches.length ? `
      <div class="mini-row"><strong>Victoires</strong><span class="match-result win">${wins}</span></div>
      <div class="mini-row"><strong>Matchs nuls</strong><span class="match-result draw">${draws}</span></div>
      <div class="mini-row"><strong>Défaites</strong><span class="match-result loss">${losses}</span></div>
    ` : '<div class="empty-state">Ajoute tes résultats pour suivre la saison.</div>';

    const planned = data.sessions.filter(s => s.status === "planned").length;
    const cancelled = data.sessions.filter(s => s.status === "cancelled").length;
    const total = data.sessions.length || 1;
    const rows = [
      ["Terminées", completed.length, "#39c98a"],
      ["À venir", planned, "#318bff"],
      ["Annulées", cancelled, "#ff6675"]
    ];
    $("#sessionOverview").innerHTML = rows.map(([label,count,color]) => `
      <div><div class="overview-row"><span>${label}</span><strong>${count}</strong></div>
      <div class="progress-track"><div class="progress-fill" style="width:${count / total * 100}%;background:${color}"></div></div></div>
    `).join("");

    const goals = data.goals.slice(0,4);
    $("#dashboardGoals").innerHTML = goals.length ? goals.map(g => {
      const player = data.players.find(p => p.id === g.playerId);
      const pct = Math.min(100, Math.round(g.progress / g.target * 100));
      return `<div class="mini-row"><div><strong>${safe(g.name)}</strong><small>${safe(player?.name || "Joueur")}</small></div><span class="pill planned">${pct}%</span></div>`;
    }).join("") : '<div class="empty-state">Aucun objectif en cours.</div>';
  }

  // Sauvegarde et restauration
  function exportData() {
    const content = {
      application: "CoachMe",
      version: 30,
      exportDate: new Date().toISOString(),
      ...data
    };
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coachme-sauvegarde.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify("Sauvegarde téléchargée.");
  }

  $("#exportBtn").addEventListener("click", exportData);

  $("#importFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== "object") throw new Error("Fichier incorrect");
      if (!confirm("Cette importation remplacera tes données actuelles. Continuer ?")) return;
      data = normalize(imported);
      save("Sauvegarde importée.");
    } catch (error) {
      console.error(error);
      notify("Fichier JSON invalide.");
    } finally {
      e.target.value = "";
    }
  });

  // Rendu général
  function renderAll() {
    refreshSelects();
    renderSessions();
    renderCalendar();
    renderTeams();
    renderPlayers();
    renderExercises();
    renderGoals();
    renderMatches();
    renderDashboard();
  }

  // Fermeture des modales avec Échap
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSession();
      closeMatch();
      $("#profileModal").classList.add("hidden");
    }
  });

  load();
  renderAll();
  console.log("CoachMe Jour 30 chargé.");
});