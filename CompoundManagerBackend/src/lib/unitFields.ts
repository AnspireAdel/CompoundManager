type UnitTypeFlags = {
  hasFloor: boolean;
  hasApartment: boolean;
};

/** Normalize floor/apartment based on unit type flags. Unused apartment stores "0". */
export function resolveUnitNumbers(
  unitType: UnitTypeFlags,
  floorNo?: number | null,
  apartmentNo?: string | number | null,
  options?: { preserveUnused?: { floorNo: number; apartmentNo: string } }
): { floorNo: number; apartmentNo: string } {
  if (unitType.hasFloor && (floorNo === undefined || floorNo === null)) {
    throw new Error('رقم الدور مطلوب لهذا النوع');
  }

  const apt =
    apartmentNo === undefined || apartmentNo === null
      ? ''
      : String(apartmentNo).trim();

  if (unitType.hasApartment && (!apt || apt === '0')) {
    throw new Error('رقم الوحدة مطلوب لهذا النوع');
  }

  const preserved = options?.preserveUnused;

  return {
    floorNo: unitType.hasFloor
      ? Number(floorNo)
      : preserved
        ? preserved.floorNo
        : 0,
    apartmentNo: unitType.hasApartment
      ? apt
      : preserved
        ? preserved.apartmentNo
        : '0',
  };
}
