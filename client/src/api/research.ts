import axios from 'axios';
import { ResearchResponse } from '../types';

const rawBaseUrl = import.meta.env.VITE_API_URL || '';
const API_BASE_URL = rawBaseUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');

export async function startResearch(question: string): Promise<ResearchResponse> {
  try {
    const url = `${API_BASE_URL}/api/research`;
    const response = await axios.post<ResearchResponse>(url, { question });
    return response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ERR_NETWORK') {
        throw new Error(
          `Network Error: Unable to reach backend at "${API_BASE_URL || 'relative path'}". Please check if your Render backend is awake and healthy.`
        );
      }
    }
    throw err;
  }
}
