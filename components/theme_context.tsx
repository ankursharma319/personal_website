
import { createContext } from 'react';

export const ThemeContext = createContext("dark");
export const SetThemeContext = createContext((theme:string)=>{return});
