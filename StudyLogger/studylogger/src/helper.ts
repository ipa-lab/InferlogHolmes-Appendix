function* _idGenerator(): Generator<number> {
  let id = 0;
  while (true) {
	yield id++;
  }
}


export const ID_GENERATOR = _idGenerator()