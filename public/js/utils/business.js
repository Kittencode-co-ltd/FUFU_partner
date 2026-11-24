// Which kind of business the selected store is, so shared screens use that business's own words
// (a grooming shop never reads "คลินิก" or "สัตวแพทย์", a clinic never reads "ห้องพัก").
import { storage } from './storage.js';
import { STORAGE_KEYS } from './config.js';

export function bizKind() {
  const c = String(storage.get(STORAGE_KEYS.STORE_CATEGORY) || '').toLowerCase();
  if (c === 'vet_clinic' || c === 'vet_hospital') return 'clinic';
  if (c === 'pet_hotel') return 'hotel';
  if (c === 'pet_grooming') return 'grooming';
  return 'shop';
}

const WORDS = {
  clinic: { store: 'คลินิก', staff: 'สัตวแพทย์' },
  hotel: { store: 'โรงแรม', staff: 'พนักงาน' },
  grooming: { store: 'ร้าน', staff: 'ช่าง' },
  shop: { store: 'ร้าน', staff: 'พนักงาน' },
};
/** bizWord('store') → 'คลินิก' | 'โรงแรม' | 'ร้าน' */
export const bizWord = key => WORDS[bizKind()][key];
