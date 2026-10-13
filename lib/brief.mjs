import {readJSON} from './store.mjs';
import {validateQuestions} from '../public/brief-schema.js';
export const briefQuestions=()=>validateQuestions(readJSON('content/brief-questions.json',[]));
