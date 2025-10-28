import React from 'react';

const map = {
  Doktor: 'public/icons/roles/doctor.svg',
  Policie: 'public/icons/roles/police.svg',
  Vyšetřovatel: 'public/icons/roles/investigator.svg',
  Pozorovatel: 'public/icons/roles/lookout.svg',
  Pastičkář: 'public/icons/roles/trapper.svg',
  Stopař: 'public/icons/roles/tracker.svg',
  Občan: 'public/icons/roles/citizen.svg',
  Vrah: 'public/icons/roles/killer.svg',
  Uklízeč: 'public/icons/roles/cleaner.svg',
  Falšovač: 'public/icons/roles/falsovac.svg',
  Opilý: 'public/icons/roles/drunk.svg',
  Poustevník: 'public/icons/roles/recluse.svg'
};

export default function RoleIcon({ role, size=24, alt }) {
  const src = map[role] || map['Občan'];
  return <img src={src} alt={alt || role} width={size} height={size} style={{display:'inline-block'}} />;
}
