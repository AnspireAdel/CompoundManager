type UnitTypeFlags = {
  hasFloor: boolean;
  hasApartment: boolean;
};

/** Normalize floor/apartment based on unit type flags. Unused fields store 0. */
export function resolveUnitNumbers(
  unitType: UnitTypeFlags,
  floorNo?: number | null,
  apartmentNo?: number | null,
  options?: { preserveUnused?: { floorNo: number; apartmentNo: number } }
): { floorNo: number; apartmentNo: number } {
  if (unitType.hasFloor && (floorNo === undefined || floorNo === null)) {
    throw new Error('رقم الدور مطلوب لهذا النوع');
  }
  if (unitType.hasApartment && (apartmentNo === undefined || apartmentNo === null || apartmentNo < 1)) {
    throw new Error('رقم الشقة مطلوب لهذا النوع');
  }

  const preserved = options?.preserveUnused;

  return {
    floorNo: unitType.hasFloor
      ? Number(floorNo)
      : preserved
        ? preserved.floorNo
        : 0,
    apartmentNo: unitType.hasApartment
      ? Number(apartmentNo)
      : preserved
        ? preserved.apartmentNo
        : 0,
  };
}
