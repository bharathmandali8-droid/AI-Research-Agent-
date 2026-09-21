import axios from 'axios';
import { ResearchResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function startResearch(question: string): Promise<ResearchResponse> {
  const response = await axios.post<ResearchResponse>(`${API_BASE_URL}/api/research`, { question });
  return response.data;
}
