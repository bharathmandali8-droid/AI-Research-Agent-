import axios from 'axios';
import { ResearchResponse } from '../types';

export async function startResearch(question: string): Promise<ResearchResponse> {
  const response = await axios.post<ResearchResponse>('/api/research', { question });
  return response.data;
}
