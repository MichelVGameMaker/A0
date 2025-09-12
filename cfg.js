// cfg.js — constantes de domaine (groupes, matériel) + mapping
(function () {
  const A = window.App || (window.App = {});

  A.cfg = {
    // Listes officielles (affichage et stockage)
    musclesG3: [
      "Pectoraux", "Dos", "Épaules", "Biceps", "Triceps",
      "Quadriceps", "Ischio", "Mollets", "Abdos", "Cardio"
    ],
    equipment: [
      "Machine", "Poids", "Poids de corps", "Élastique", "Barre", "Autre"
    ],

    // Mapping calculé à l’enregistrement : Group3 -> Group2 --> Group1
    mapGroups(g3) {
      const upper = ["Pectoraux", "Dos", "Épaules", "Biceps", "Triceps"];
      const legs  = ["Quadriceps", "Ischio", "Mollets"];
      if (!g3) return { g2: "", g1: "" };
      if (upper.includes(g3)) return { g2: (g3 === "Biceps" || g3 === "Triceps") ? "Bras" : g3, g1: "Haut" };
      if (legs.includes(g3))  return { g2: "Jambes", g1: "Bas" };
      if (g3 === "Abdos")     return { g2: "Abdos",  g1: "Cardio" };
      if (g3 === "Cardio")    return { g2: "Cardio", g1: "Cardio" };
      return { g2: "", g1: "" };
    }
  };
})();
