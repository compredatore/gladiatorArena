import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Backend URL

export const setupArena = async () => {
  const response = await axios.post(`${API_BASE_URL}/arena/setup`);
  return response.data;
};

export const startMatch = async (modelA: string, modelB: string) => {
  const response = await axios.post(`${API_BASE_URL}/arena/start`, { model_a: modelA, model_b: modelB });
  return response.data;
};

export const executeRound = async () => {
  const response = await axios.post(`${API_BASE_URL}/arena/round`);
  return response.data;
};
