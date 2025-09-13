// cfg.js — transcodification & constantes calculées (auto-généré depuis Excel)
(function(){
  const CFG = {};

  // ====== Equipment -> Groupes (clé: equipment brut, lowercase) ======
  CFG.equipmentTranscode = {
    'body weight': { g1: 'Body weight', g2: 'Body weight' },
    'weighted': { g1: 'Weighted', g2: 'Body weight' },
    'band': { g1: 'Bande', g2: 'Machine' },
    'cable': { g1: 'cable', g2: 'Machine' },
    'leverage machine': { g1: 'leverage machine', g2: 'Machine' },
    'smith machine': { g1: 'smith machine', g2: 'Machine' },
    'elliptical machine': { g1: 'cardio machine', g2: 'Machine' },
    'skierg machine': { g1: 'cardio machine', g2: 'Machine' },
    'stationary bike': { g1: 'cardio machine', g2: 'Machine' },
    'stepmill machine': { g1: 'cardio machine', g2: 'Machine' },
    'upper body ergometer': { g1: 'cardio machine', g2: 'Machine' },
    'resistance tube': { g1: 'Bande', g2: 'Machine' },
    'stairmaster': { g1: 'cardio machine', g2: 'Machine' },
    'rowing machine': { g1: 'cardio machine', g2: 'Machine' },
    'treadmill': { g1: 'cardio machine', g2: 'Machine' },
    'sled machine': { g1: 'sled Machine', g2: 'Machine' },
	'assisted': { g1: 'assisted', g2: 'Machine' },
    'resistance band': { g1: 'Bande', g2: 'Machine' },
	'sled': { g1: 'sled', g2: 'sled' },
    'trap bar': { g1: 'trap bar', g2: 'Free weights' },
    'ez barbell': { g1: 'barbell', g2: 'Free weights' },
    'barbell': { g1: 'barbell', g2: 'Free weights' },
    'dumbbell': { g1: 'dumbbell', g2: 'Free weights' },
    'kettlebell': { g1: 'kettlebell', g2: 'Free weights' },
    'olympic barbell': { g1: 'barbell', g2: 'Free weights' },
    'weighted plate': { g1: 'plate', g2: 'Free weights' },
    'bosu': { g1: 'Ball', g2: 'Other' },
	'bosu ball': { g1: 'Ball', g2: 'Other' },
    'stability ball': { g1: 'Ball', g2: 'Other' },
    'medicine ball': { g1: 'Ball', g2: 'Other' },
	'tire': { g1: 'tire', g2: 'Other' },
    'belt': { g1: 'belt', g2: 'Other' },
	'rope': { g1: 'rope', g2: 'Other' },
    'wheel roller': { g1: 'wheel roller', g2: 'Other' },
	'roller': { g1: 'roller', g2: 'Other' },
	'roller massager': { g1: 'roller', g2: 'Other' },
    'hammer': { g1: 'hammer', g2: 'Other' }

  };

  // ====== TargetMuscle -> Muscle + Groupes (clé: target brut, lowercase) ======
  CFG.muscleTranscode = {
    'glutes': { muscle: 'glutes', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'quads': { muscle: 'quads', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'hamstrings': { muscle: 'hamstrings', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'abductors': { muscle: 'abductors', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'adductors': { muscle: 'adductors', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'calves': { muscle: 'calves', g1: 'lower legs', g2: 'legs', g3: 'Lower Body' },
    'lats': { muscle: 'lats', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'upper back': { muscle: 'upper back', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'spine': { muscle: 'spine', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'traps': { muscle: 'traps', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'neck': { muscle: 'neck', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'biceps': { muscle: 'biceps', g1: 'upper arms', g2: 'arms', g3: 'Upper Body' },
    'triceps': { muscle: 'triceps', g1: 'upper arms', g2: 'arms', g3: 'Upper Body' },
    'forearms': { muscle: 'forearms', g1: 'lower arms', g2: 'arms', g3: 'Upper Body' },
    'chest': { muscle: 'chest', g1: 'chest', g2: 'chest', g3: 'Upper Body' },
    'shoulders': { muscle: 'shoulders', g1: 'shoulders', g2: 'shoulders', g3: 'Upper Body' },
    'abs': { muscle: 'abs', g1: 'waist', g2: 'core', g3: 'Core' },
    'serratus anterior': { muscle: 'serratus anterior', g1: 'waist', g2: 'core', g3: 'Core' },
    'obliques': { muscle: 'obliques', g1: 'waist', g2: 'core', g3: 'Core' },
    'abductors (hip)': { muscle: 'abductors (hip)', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'adductors (hip)': { muscle: 'adductors (hip)', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'gluteus medius': { muscle: 'gluteus medius', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' }
  };

  Object.defineProperty(CFG, 'equipment', {
    get(){ return Array.from(new Set(Object.values(CFG.equipmentTranscode).map(x=>x.g2).filter(Boolean))); }
  });
  Object.defineProperty(CFG, 'musclesG3', {
    get(){ return Array.from(new Set(Object.values(CFG.muscleTranscode).map(x=>x.g3).filter(Boolean))); }
  });

  CFG.decodeEquipment = function(raw){
    if (!raw) return { equipment:null, g1:null, g2:null };
    const hit = CFG.equipmentTranscode[String(raw).trim().toLowerCase()];
    return { equipment: raw, g1: hit?.g1 || null, g2: hit?.g2 || null };
  };
  CFG.decodeMuscle = function(raw){
    if (!raw) return { muscle:null, g1:null, g2:null, g3:null };
    const hit = CFG.muscleTranscode[String(raw).trim().toLowerCase()];
    return { muscle: hit?.muscle || raw, g1: hit?.g1 || null, g2: hit?.g2 || null, g3: hit?.g3 || null };
  };

  window.CFG = CFG;
})();
