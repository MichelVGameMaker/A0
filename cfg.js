// cfg.js — transcodification & constantes calculées (auto-généré depuis Excel)
(function(){
  const CFG = {};

  // ====== Equipment -> Groupes (clé: equipment brut, lowercase) ======
  CFG.equipmentTranscode = {
    'body weight': { g1: 'Body weight', g2: 'Body weight' },
    'weighted': { g1: 'Weighted', g2: 'Body weight' },
    'band': { g1: 'Band', g2: 'Machine' },
    'cable': { g1: 'Cable', g2: 'Machine' },
    'leverage machine': { g1: 'Leverage machine', g2: 'Machine' },
    'smith machine': { g1: 'Smith machine', g2: 'Machine' },
    'elliptical machine': { g1: 'Cardio machine', g2: 'Machine' },
    'skierg machine': { g1: 'Cardio machine', g2: 'Machine' },
    'stationary bike': { g1: 'Cardio machine', g2: 'Machine' },
    'stepmill machine': { g1: 'Cardio machine', g2: 'Machine' },
    'upper body ergometer': { g1: 'Cardio machine', g2: 'Machine' },
    'stairmaster': { g1: 'Cardio machine', g2: 'Machine' },
    'treadmill': { g1: 'Cardio machine', g2: 'Machine' },
    'sled machine': { g1: 'sled Machine', g2: 'Machine' },
    'barbell': { g1: 'Barbell', g2: 'Free weights' },
    'ez barbell': { g1: 'Barbell', g2: 'Free weights' },
    'olympic barbell': { g1: 'Barbell', g2: 'Free weights' },
    'trap bar': { g1: 'Barbell', g2: 'Free weights' },
    'dumbbell': { g1: 'Dumbbell', g2: 'Free weights' },
    'kettlebell': { g1: 'Kettlebell', g2: 'Free weights' },
    'weighted plate': { g1: 'plate', g2: 'Free weights' },
	'bosu ball': { g1: 'Ball', g2: 'Other equipment' },
    'stability ball': { g1: 'Ball', g2: 'Other equipment' },
    'medicine ball': { g1: 'Ball', g2: 'Other equipment' },
 	'assisted': { g1: 'Assisted', g2: 'Other equipment' },
    'resistance band': { g1: 'Band', g2: 'Other equipment' },
	'rope': { g1: 'Rope', g2: 'Other equipment' },
	'sled': { g1: 'sled machine', g2: 'Other equipment' },
	'belt': { g1: 'Belt', g2: 'Other equipment' },
    'wheel roller': { g1: 'Roller', g2: 'Other equipment' },
	'roller': { g1: 'Roller', g2: 'Other equipment' },
 	'tire': { g1: 'Tire', g2: 'Other equipment' },
	'hammer': { g1: 'Hammer', g2: 'Other equipment' }

  };

  // ====== TargetMuscle -> Muscle + Groupes (clé: target brut, lowercase) ======
  CFG.muscleTranscode = {
    'lats':  { muscle: 'lats', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'upper back': { muscle: 'upper back', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'spine': { muscle: 'spine', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'traps': { muscle: 'traps', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'neck': { muscle: 'neck', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'levator scapulae': { muscle: 'neck', g1: 'upper back', g2: 'back', g3: 'Upper Body' },
    'biceps': { muscle: 'biceps', g1: 'upper arms', g2: 'arms', g3: 'Upper Body' },
    'triceps': { muscle: 'triceps', g1: 'upper arms', g2: 'arms', g3: 'Upper Body' },
    'forearms': { muscle: 'forearms', g1: 'lower arms', g2: 'arms', g3: 'Upper Body' },
	'delts': { muscle: 'shoulders', g1: 'shoulders', g2: 'shoulders', g3: 'Upper Body' },
	'shoulders': { muscle: 'shoulders', g1: 'shoulders', g2: 'shoulders', g3: 'Upper Body' },
    'chest': { muscle: 'chest', g1: 'chest', g2: 'chest', g3: 'Upper Body' },
    'pectorals': { muscle: 'pectorals', g1: 'chest', g2: 'chest', g3: 'Upper Body' },
    'serratus anterior': { muscle: 'serratus anterior', g1: 'chest', g2: 'chest', g3: 'Upper Body' },
    'abs': { muscle: 'abs', g1: 'waist', g2: 'core', g3: 'Core' },
    'obliques': { muscle: 'obliques', g1: 'waist', g2: 'core', g3: 'Core' },
    'cardiovascular system': { muscle: 'cardio', g1: 'waist', g2: 'core', g3: 'Core' },
    'abductors (hip)': { muscle: 'abductors', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'adductors (hip)': { muscle: 'adductors', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'gluteus medius': { muscle: 'glutes', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
	'glutes': { muscle: 'glutes', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'quads': { muscle: 'quads', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'hamstrings': { muscle: 'hamstrings', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'abductors': { muscle: 'abductors', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'adductors': { muscle: 'adductors', g1: 'upper legs', g2: 'legs', g3: 'Lower Body' },
    'calves': { muscle: 'calves', g1: 'lower legs', g2: 'legs', g3: 'Lower Body' }
  };


	Object.defineProperty(CFG, 'equipment', {
		get(){ return Array.from(new Set(Object.values(CFG.equipmentTranscode).map(x=>x.g2).filter(Boolean))); }
	});
	Object.defineProperty(CFG, 'equipmentG2', {
		get(){ return Array.from(new Set(Object.values(CFG.equipmentTranscode).map(x=>x.g2).filter(Boolean))); }
	});
	Object.defineProperty(CFG, 'equipmentG1', {
		get(){ return Array.from(new Set(Object.values(CFG.equipmentTranscode).map(x=>x.g1).filter(Boolean))); }
	});
	Object.defineProperty(CFG, 'musclesG3', {
		get(){ return Array.from(new Set(Object.values(CFG.muscleTranscode).map(x=>x.g3).filter(Boolean))); }
	});
	Object.defineProperty(CFG, 'musclesG2', {
		get(){ return Array.from(new Set(Object.values(CFG.muscleTranscode).map(x=>x.g2).filter(Boolean))); }
	});
	Object.defineProperty(CFG, 'musclesG1', {
		get(){ return Array.from(new Set(Object.values(CFG.muscleTranscode).map(x=>x.g1).filter(Boolean))); }
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
