export function advancedFilter(patients: any[], query: string) {
  return patients.filter(p => p.name.includes(query) || p.age.toString() === query);
}
