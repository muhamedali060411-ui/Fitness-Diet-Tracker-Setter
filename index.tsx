
import React, { useState, useEffect, FormEvent, useId } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import {
  ArrowRight,
  Sparkles,
  Utensils,
  Dumbbell,
  ChevronDown,
  Flame,
  Fish,
  RotateCcw,
  AlertTriangle,
  Zap,
  History,
  Trash2,
  Calendar,
  Weight,
  Target,
  LineChart,
  PlusCircle,
  Clock,
  StickyNote,
  Award,
  User,
  X,
  Droplet,
  CheckCircle
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- TYPES ---
enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other'
}

enum CharacterGender {
    MALE = 'Male',
    FEMALE = 'Female',
}

enum ActivityLevel {
  SEDENTARY = 'Sedentary (little or no exercise)',
  LIGHTLY_ACTIVE = 'Lightly active (light exercise/sports 1-3 days/week)',
  MODERATELY_ACTIVE = 'Moderately active (moderate exercise/sports 3-5 days/week)',
  VERY_ACTIVE = 'Very active (hard exercise/sports 6-7 days a week)',
  SUPER_ACTIVE = 'Super active (very hard exercise/physical job & exercise two times a day)'
}

enum FitnessGoal {
  LOSE_WEIGHT = 'Lose Weight',
  GAIN_MUSCLE = 'Gain Muscle',
  MAINTAIN_WEIGHT = 'Maintain Weight'
}

enum Language {
  ENGLISH = 'English',
  GERMAN = 'German',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  ITALIAN = 'Italian',
  PORTUGUESE = 'Portuguese',
  DUTCH = 'Dutch',
  RUSSIAN = 'Russian',
  CHINESE_SIMPLIFIED = 'Chinese (Simplified)',
  JAPANESE = 'Japanese'
}

enum Intensity {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High',
}

interface ActivityLog {
    id: string;
    date: string;
    type: string;
    duration?: number; // in minutes
    intensity?: Intensity;
    notes?: string;
    amount?: number; // in ml for water
}

interface UserData {
  age: number;
  gender: Gender;
  weight: number;
  height: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  timeframe: number; // in weeks
  language: Language;
  waterIntake: number; // in liters
  preferredFoods?: string;
}

interface WorkoutDay {
  [day: string]: string[];
}

interface Meal {
  description: string;
  calories: number;
  protein: number;
}

interface DietDay {
  [day: string]: {
    Breakfast: Meal[];
    Lunch: Meal[];
    Dinner: Meal[];
    Snacks: Meal[];
  };
}

interface FitnessPlan {
  summary: string;
  workoutPlan: WorkoutDay;
  dietPlan: DietDay;
  recommendedWaterIntake: number; // in liters
}

interface SavedPlan {
  id: string;
  date: string;
  userData: UserData;
  plan: FitnessPlan;
  completionStatus: Record<string, boolean>;
}

// --- CONSTANTS ---
const GENDER_OPTIONS = Object.values(Gender);
const ACTIVITY_LEVEL_OPTIONS = Object.values(ActivityLevel);
const FITNESS_GOAL_OPTIONS = Object.values(FitnessGoal);
const LANGUAGE_OPTIONS = Object.values(Language);
const DAYS_PER_LEVEL = 5;

// --- HELPERS ---
const calculateLevel = (activityLog: ActivityLog[]) => {
    const uniqueWorkoutDays = new Set(activityLog.filter(log => log.type !== 'Water Intake').map(log => log.date)).size;
    const level = Math.floor(uniqueWorkoutDays / DAYS_PER_LEVEL) + 1;
    const progress = uniqueWorkoutDays % DAYS_PER_LEVEL;
    return {
        level,
        progress,
        activeDays: uniqueWorkoutDays,
        xpForNextLevel: DAYS_PER_LEVEL
    };
};

// --- GEMINI SERVICE ---
const generateFitnessPlan = async (userData: UserData): Promise<FitnessPlan> => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
      throw new Error("API_KEY environment variable is not set");
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const mealItemSchema = {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: "Description of the food item." },
            calories: { type: Type.NUMBER, description: "Estimated calories per portion." },
            protein: { type: Type.NUMBER, description: "Estimated protein in grams per portion." }
        },
        required: ['description', 'calories', 'protein']
    };

    const dailyDietSchema = {
        type: Type.OBJECT,
        properties: {
            Breakfast: { type: Type.ARRAY, items: mealItemSchema },
            Lunch: { type: Type.ARRAY, items: mealItemSchema },
            Dinner: { type: Type.ARRAY, items: mealItemSchema },
            Snacks: { type: Type.ARRAY, items: mealItemSchema }
        }
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            summary: {
                type: Type.STRING,
                description: "A brief, motivational summary of the plan, max 2 sentences."
            },
            workoutPlan: {
                type: Type.OBJECT,
                description: "A 7-day workout plan. Keys should be days of the week (e.g., 'Monday').",
                properties: {
                    Monday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Monday" } },
                    Tuesday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Tuesday" } },
                    Wednesday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Wednesday" } },
                    Thursday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Thursday" } },
                    Friday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Friday" } },
                    Saturday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Saturday" } },
                    Sunday: { type: Type.ARRAY, items: { type: Type.STRING, description: "Exercise for Sunday, often a rest day." } }
                },
            },
            dietPlan: {
                type: Type.OBJECT,
                description: "A 7-day diet plan with nutritional info. Keys should be days of the week.",
                properties: {
                    Monday: dailyDietSchema,
                    Tuesday: dailyDietSchema,
                    Wednesday: dailyDietSchema,
                    Thursday: dailyDietSchema,
                    Friday: dailyDietSchema,
                    Saturday: dailyDietSchema,
                    Sunday: dailyDietSchema,
                }
            },
            recommendedWaterIntake: {
                type: Type.NUMBER,
                description: "Recommended daily water intake goal in liters (e.g., 3.5)."
            }
        }
    };

    const generatePrompt = (userData: UserData): string => {
      return `
        You are an expert fitness coach and nutritionist. Your task is to generate a personalized 7-day workout and diet plan.

        **IMPORTANT**: The plan's content (summaries, exercise names, meal descriptions, etc.) must be written in ${userData.language}. The JSON structure, including all keys (like "summary", "workoutPlan", "calories", "protein"), MUST remain in English as defined in the schema.

        User Data:
        - Age: ${userData.age}
        - Gender: ${userData.gender}
        - Weight: ${userData.weight} kg
        - Height: ${userData.height} cm
        - Activity Level: ${userData.activityLevel}
        - Fitness Goal: ${userData.goal}
        - Timeframe: ${userData.timeframe} weeks
        - Current Daily Water Intake: ${userData.waterIntake} liters
        - Preferred Foods: ${userData.preferredFoods || 'None specified'}
        - Desired Language for Plan: ${userData.language}

        Instructions:
        1.  Generate all textual content for the plan in ${userData.language}.
        2.  Create a balanced workout plan. For a 'Gain Muscle' goal, focus on strength training. For 'Lose Weight', combine cardio and resistance training. For 'Maintain Weight', suggest a mix of activities. Include at least one rest day.
        3.  Create a healthy diet plan with suggestions for Breakfast, Lunch, Dinner, and Snacks for each of the 7 days.
        4.  Incorporate the user's "Preferred Foods" into some meals, but do not overuse them. Ensure the overall diet plan is varied, balanced, and interesting. It should include a wide range of other healthy ingredients to meet nutritional needs and prevent the plan from becoming repetitive, even if a specific food is preferred.
        5.  For EACH meal item (in Breakfast, Lunch, Dinner, and Snacks), you MUST provide an estimated 'calories' (number) and 'protein' in grams (number).
        6.  Based on the user's data, calculate a 'recommendedWaterIntake' in liters and include it in the response.
        7.  Ensure the plan is encouraging, safe, and tailored to the user's profile.
        8.  The output MUST be a valid JSON object matching the provided schema. The JSON keys MUST be in English. Do not include any markdown formatting like \`\`\`json.
        `;
    };

    const prompt = generatePrompt(userData);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.7,
            },
        });
        
        const jsonText = response.text.trim();
        const plan = JSON.parse(jsonText);
        return plan;

    } catch (error) {
        console.error("Error generating fitness plan:", error);
        throw new Error("Failed to generate a fitness plan. The model may be unavailable or the request was invalid. Please try again.");
    }
};

// --- COMPONENTS ---

const LoadingSpinner: React.FC = () => {
  const motivationalMessages = [
    "Crafting your personalized plan...",
    "Analyzing your fitness goals...",
    "Building your path to success...",
    "Consulting with our AI experts...",
    "Tailoring your workouts and meals...",
    "Just a moment, greatness awaits!",
  ];
  const [message, setMessage] = useState(motivationalMessages[0]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessage(prevMessage => {
        const currentIndex = motivationalMessages.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % motivationalMessages.length;
        return motivationalMessages[nextIndex];
      });
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-slate-300 h-96 animate-fade-in">
      <svg className="w-16 h-16 animate-spin-slow" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" stroke="#334155" strokeWidth="5" fill="none" />
        <path d="M50 5 A 45 45 0 0 1 95 50" stroke="#AFFF00" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
      <p className="text-lg font-semibold text-center transition-opacity duration-500">{message}</p>
    </div>
  );
};

const ErrorMessage: React.FC<{ message: string; onRetry: () => void; }> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-red-400 p-8 bg-red-900/10 border-2 border-red-500/20 rounded-2xl max-w-lg mx-auto animate-fade-in">
      <AlertTriangle className="w-12 h-12 text-red-500" />
      <p className="font-semibold text-xl text-red-300">An Error Occurred</p>
      <p className="text-center text-sm text-red-400">{message}</p>
      <button 
        type="button" 
        onClick={onRetry}
        className="mt-4 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
};

const MealSection: React.FC<{title: string, items: Meal[]}> = ({ title, items }) => {
    if (!items || items.length === 0) return null;
    return (
        <div>
            <h5 className="font-semibold text-slate-200 mb-2">{title}</h5>
            <ul className="space-y-2">
                {items.map((item, i) => (
                    <li key={i} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:items-start text-sm p-2 bg-slate-800/50 rounded-md">
                    <span className="flex-1 text-slate-300">{item.description}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-shrink-0">
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400"/> {item.calories} kcal</span>
                        <span className="flex items-center gap-1"><Fish className="w-3 h-3 text-cyan-400"/> {item.protein}g protein</span>
                    </div>
                    </li>
                ))}
            </ul>
        </div>
    )
};

const DayCard: React.FC<{
    day: string,
    plan: FitnessPlan,
    isExpanded: boolean,
    onToggle: (day: string) => void,
    isCompleted?: boolean,
    onMarkComplete?: (day: string) => void
}> = ({ day, plan, isExpanded, onToggle, isCompleted, onMarkComplete }) => {
    const workout = plan.workoutPlan[day];
    const diet = plan.dietPlan[day];
    const isRestDay = !workout || workout.length === 0;

    return (
        <div className="bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300">
            <button
                onClick={() => onToggle(day)}
                className="w-full flex justify-between items-center p-4 sm:p-6 text-left"
            >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <h3 className="text-xl font-bold text-slate-100">{day}</h3>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${isRestDay ? 'bg-sky-500/20 text-sky-300' : 'bg-[#AFFF00]/20 text-[#AFFF00]'}`}>
                        {isRestDay ? 'Rest Day' : workout[0].split('(')[0].trim()}
                    </span>
                </div>
                <ChevronDown className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 sm:px-6 pb-6 animate-fade-in-down">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                        <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <h4 className="flex items-center gap-2 font-semibold text-lg text-[#AFFF00]"><Dumbbell /> Workout</h4>
                                {onMarkComplete && !isRestDay && (
                                    isCompleted ? (
                                        <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
                                            <CheckCircle className="w-5 h-5"/> Completed
                                        </div>
                                    ) : (
                                        <button onClick={() => onMarkComplete(day)} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-[#AFFF00] bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg transition-colors">
                                           <CheckCircle className="w-5 h-5"/> Mark as Done
                                        </button>
                                    )
                                )}
                            </div>
                            <ul className="list-disc list-inside space-y-2 text-slate-300 pl-2">
                               {isRestDay ? <li>Active Recovery or Full Rest</li> : workout.map((ex, i) => <li key={i}>{ex}</li>)}
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 font-semibold text-lg text-[#AFFF00]"><Utensils /> Diet</h4>
                            {diet ? (
                                <div className="space-y-3 text-slate-300">
                                    <MealSection title="Breakfast" items={diet.Breakfast} />
                                    <MealSection title="Lunch" items={diet.Lunch} />
                                    <MealSection title="Dinner" items={diet.Dinner} />
                                    <MealSection title="Snacks" items={diet.Snacks} />
                                </div>
                            ) : <p className="text-slate-400">No diet plan specified.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PlanDisplay: React.FC<{
    plan: FitnessPlan;
    onBack: () => void;
    backButtonText?: string;
    completionStatus?: Record<string, boolean>;
    onMarkComplete?: (day: string) => void;
}> = ({ plan, onBack, backButtonText = "Start Over", completionStatus, onMarkComplete }) => {
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const toggleDay = (day: string) => {
    setExpandedDay(expandedDay === day ? null : day);
  };
  
  return (
    <div className="w-full animate-fade-in space-y-8">
      <div className="text-center p-6 bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-[#AFFF00] mb-2">Your Personalized Plan</h2>
        <p className="text-slate-300 italic max-w-2xl mx-auto">{plan.summary}</p>
        <p className="text-slate-300 mt-2 flex items-center justify-center gap-2">
            <Droplet className="w-4 h-4 text-sky-400" /> Daily Water Goal: <span className="font-bold text-white">{plan.recommendedWaterIntake} Liters</span>
        </p>
      </div>

      <div className="space-y-4">
        {DAYS_OF_WEEK.map(day => (
          <DayCard 
            key={day}
            day={day}
            plan={plan}
            isExpanded={expandedDay === day}
            onToggle={toggleDay}
            isCompleted={completionStatus?.[day]}
            onMarkComplete={onMarkComplete}
          />
        ))}
      </div>
      
      <div className="text-center pt-4">
         <button 
          type="button" 
          onClick={onBack}
          className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors mx-auto"
        >
          <RotateCcw className="w-4 h-4" />
          {backButtonText}
        </button>
      </div>
    </div>
  );
};

const InputField: React.FC<{
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    isMultiNumber?: boolean;
    unit?: string;
    placeholder?: string;
}> = ({ name, label, value, onChange, error, isMultiNumber = false, unit, placeholder }) => {
    const id = useId();
    return (
        <div className="relative flex flex-col">
        <label htmlFor={id} className="text-sm font-medium text-slate-400 mb-2">{label}</label>
        <input
            type="text"
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className={`bg-[#1e1e1e] border-2 ${error ? 'border-red-500' : 'border-slate-700'} rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#AFFF00] focus:border-[#AFFF00] transition-colors w-full`}
            placeholder={placeholder || (isMultiNumber ? 'e.g., 70 or 70.5' : '')}
        />
        {unit && <span className="absolute top-10 right-0 pr-3 flex items-center text-sm text-slate-500">{unit}</span>}
        {isMultiNumber && !error && <p className="text-slate-500 text-xs mt-2">Enter single or comma-separated values (average is used).</p>}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
    );
};

const SelectField: React.FC<{
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
}> = ({ name, label, value, onChange, options }) => {
    const id = useId();
    return(
        <div className="flex flex-col">
            <label htmlFor={id} className="text-sm font-medium text-slate-400 mb-2">{label}</label>
            <select
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full bg-[#1e1e1e] border-2 border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#AFFF00] focus:border-[#AFFF00] transition-colors appearance-none"
            >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );
};

const UserInputForm: React.FC<{ onSubmit: (data: UserData) => void; isLoading: boolean; }> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    age: '30',
    gender: Gender.MALE,
    weight: '80',
    height: '180',
    activityLevel: ActivityLevel.MODERATELY_ACTIVE,
    goal: FitnessGoal.GAIN_MUSCLE,
    timeframe: '12',
    language: Language.ENGLISH,
    waterIntake: '3',
    preferredFoods: 'chicken, brown rice, broccoli',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumericField = ['age', 'weight', 'height', 'timeframe', 'waterIntake'].includes(name);

    if (isNumericField) {
        // Allow numbers, commas, spaces, and one dot for decimals
        if (/^[\d, .]*$/.test(value)) {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const validateNumericField = (value: string, fieldName: string): string | null => {
        if (!value.trim()) return `${fieldName} is required.`;
        const numbers = value.split(',').map(s => s.trim()).filter(Boolean).map(Number);
        if (numbers.length === 0 || numbers.some(isNaN)) return `Invalid number format. Use numbers, commas, or decimals.`;
        if (numbers.some(n => n <= 0)) return `Must be a positive number.`;
        return null;
    }

    ['age', 'weight', 'height', 'timeframe', 'waterIntake'].forEach(field => {
        const error = validateNumericField(formData[field as keyof typeof formData], field.charAt(0).toUpperCase() + field.slice(1));
        if (error) newErrors[field] = error;
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
        const processNumericInput = (value: string): number => {
            const numbers = value.split(',').map(s => s.trim()).filter(Boolean).map(Number);
            const sum = numbers.reduce((a, b) => a + b, 0);
            return parseFloat((sum / numbers.length).toFixed(2));
        };

        onSubmit({
          age: Math.round(processNumericInput(formData.age)),
          gender: formData.gender as Gender,
          weight: processNumericInput(formData.weight),
          height: processNumericInput(formData.height),
          activityLevel: formData.activityLevel as ActivityLevel,
          goal: formData.goal as FitnessGoal,
          timeframe: Math.round(processNumericInput(formData.timeframe)),
          language: formData.language as Language,
          waterIntake: processNumericInput(formData.waterIntake),
          preferredFoods: formData.preferredFoods,
        });
    }
  };

  return (
    <div className="bg-[#1e1e1e]/50 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-2xl mx-auto animate-fade-in">
        <form onSubmit={handleSubmit} className="space-y-8">
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <legend className="text-xl font-semibold text-[#AFFF00] mb-4 w-full col-span-1 md:col-span-2">1. About You</legend>
                <InputField name="age" label="Age" value={formData.age} onChange={handleChange} error={errors.age} isMultiNumber />
                <SelectField name="gender" label="Gender" value={formData.gender} onChange={handleChange} options={GENDER_OPTIONS} />
                <InputField name="weight" label="Weight" unit="kg" value={formData.weight} onChange={handleChange} error={errors.weight} isMultiNumber />
                <InputField name="height" label="Height" unit="cm" value={formData.height} onChange={handleChange} error={errors.height} isMultiNumber />
            </fieldset>

            <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-[#AFFF00] mb-4 w-full">2. Your Lifestyle & Goals</legend>
                 <SelectField name="activityLevel" label="Activity Level" value={formData.activityLevel} onChange={handleChange} options={ACTIVITY_LEVEL_OPTIONS} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SelectField name="goal" label="Primary Goal" value={formData.goal} onChange={handleChange} options={FITNESS_GOAL_OPTIONS} />
                    <InputField name="timeframe" label="Timeframe" unit="weeks" value={formData.timeframe} onChange={handleChange} error={errors.timeframe} isMultiNumber />
                </div>
            </fieldset>
            
            <fieldset>
                <legend className="text-xl font-semibold text-[#AFFF00] mb-4 w-full">3. Preferences</legend>
                 <InputField name="waterIntake" label="Current Daily Water Intake" unit="liters" value={formData.waterIntake} onChange={handleChange} error={errors.waterIntake} isMultiNumber />
                <div className="mt-6">
                    <InputField name="preferredFoods" label="Preferred Foods (optional)" placeholder="e.g., salmon, quinoa, spinach" value={formData.preferredFoods} onChange={handleChange} error={errors.preferredFoods} />
                    <p className="text-slate-500 text-xs mt-2">List foods you enjoy, separated by commas.</p>
                </div>
                <div className="mt-6">
                    <SelectField name="language" label="Plan Language" value={formData.language} onChange={handleChange} options={LANGUAGE_OPTIONS} />
                </div>
            </fieldset>

            <div className="pt-4">
                <button 
                type="submit" 
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-[#AFFF00] hover:bg-lime-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
                >
                <Sparkles className="w-5 h-5" />
                <span>{isLoading ? 'Crafting Your Plan...' : 'Generate My Plan'}</span>
                <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </form>
    </div>
  );
};


const CharacterAvatar: React.FC<{ gender: CharacterGender; level: number }> = ({ gender, level }) => {
    const maleBase = <path d="M40 90 L40 55 C40 40, 60 40, 60 55 L60 90 M50 55 C40 35, 60 35, 50 15 M40 90 L25 150 M60 90 L75 150 M30 95 L70 95" />;
    const femaleBase = <path d="M40 95 L40 60 C35 45, 65 45, 60 60 L60 95 M50 60 C40 40, 60 40, 50 20 M40 95 L30 150 M60 95 L70 150 M35 100 C40 90, 60 90, 65 100" />;

    const details = [
        { level: 3, male: <path d="M45 70 L55 70 M45 80 L55 80" />, female: <path d="M46 75 L54 75" /> },
        { level: 5, male: <path d="M42 60 L38 75 M58 60 L62 75 M45 65 C40 60, 60 60, 55 65" />, female: <path d="M42 65 L38 80 M58 65 L62 80" /> },
        { level: 7, male: <path d="M25 150 L20 120 L40 90 M75 150 L80 120 L60 90" />, female: <path d="M30 150 L25 125 L40 95 M70 150 L75 125 L60 95" /> },
        { level: 10, male: <path d="M50 55 L50 90 M45 90 L55 90" />, female: <path d="M50 60 L50 95" /> },
    ];

    return (
        <svg viewBox="0 0 100 160" className="w-24 h-40 drop-shadow-[0_0_10px_rgba(175,255,0,0.3)]">
            <g stroke="#AFFF00" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                {gender === CharacterGender.MALE ? maleBase : femaleBase}
                {details.map(d => level >= d.level && (
                    <g key={d.level} className="opacity-80">
                        {gender === CharacterGender.MALE ? d.male : d.female}
                    </g>
                ))}
            </g>
        </svg>
    );
};

const LevelUpModal: React.FC<{
    level: number;
    gender: CharacterGender;
    onClose: () => void;
}> = ({ level, gender, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gradient-to-br from-[#1e1e1e] to-[#151515] border-2 border-[#AFFF00]/30 rounded-2xl shadow-2xl p-8 text-center max-w-sm m-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X />
                </button>
                <div className="flex justify-center mb-4">
                    <div className="relative">
                         <CharacterAvatar gender={gender} level={level} />
                         <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300 animate-pulse" />
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-[#AFFF00] mb-2">LEVEL UP!</h2>
                <p className="text-slate-300 text-lg mb-4">You've reached</p>
                <p className="text-6xl font-black text-white tracking-tighter mb-6">Level {level}</p>
                <button 
                    onClick={onClose}
                    className="w-full bg-[#AFFF00] hover:bg-lime-400 text-black font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    Keep Going!
                </button>
            </div>
        </div>
    );
};

const WaterTracker: React.FC<{
    onLogWater: (amount: number) => void;
    dailyGoal: number; // in ml
    currentAmount: number; // in ml
}> = ({ onLogWater, dailyGoal, currentAmount }) => {
    const progress = dailyGoal > 0 ? (currentAmount / dailyGoal) * 100 : 0;
    const quickAddAmounts = [250, 500, 750];

    return (
        <div className="bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl p-6 h-full flex flex-col">
            <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2"><Droplet className="text-sky-400"/> Water Tracker</h3>
            <div className="flex-grow">
                <div className="relative w-full bg-slate-700 rounded-full h-6">
                    <div 
                        className="bg-sky-500 h-6 rounded-full transition-all duration-500" 
                        style={{width: `${Math.min(progress, 100)}%`}}
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {currentAmount} / {dailyGoal} ml
                    </span>
                </div>
                <div className="mt-4">
                    <p className="text-sm text-slate-400 mb-2">Quick Add:</p>
                    <div className="flex gap-2">
                        {quickAddAmounts.map(amount => (
                            <button key={amount} onClick={() => onLogWater(amount)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold py-2 rounded-lg transition-colors">
                                +{amount}ml
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const ActivityTracker: React.FC<{
    onLogActivity: (activity: Omit<ActivityLog, 'id' | 'date'>) => void;
    activityLog: ActivityLog[];
}> = ({ onLogActivity, activityLog }) => {
    const [formData, setFormData] = useState({
        type: '',
        duration: '',
        intensity: Intensity.MEDIUM,
        notes: ''
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if(!formData.type || !formData.duration) return;

        onLogActivity({
            ...formData,
            duration: Number(formData.duration)
        });
        setFormData({ type: '', duration: '', intensity: Intensity.MEDIUM, notes: '' });
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if(name === "duration" && !/^\d*$/.test(value)) return;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const id = useId();

    const recentWorkouts = [...activityLog]
        .filter(log => log.type !== 'Water Intake')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-4">Log Custom Activity</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col">
                        <label htmlFor={`${id}-type`} className="text-sm font-medium text-slate-400 mb-2">Workout Type</label>
                        <input
                            type="text"
                            id={`${id}-type`}
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            placeholder="e.g., Running, Weightlifting"
                            className="bg-[#121212] border-2 border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#AFFF00] focus:border-[#AFFF00] transition-colors"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col">
                            <label htmlFor={`${id}-duration`} className="text-sm font-medium text-slate-400 mb-2">Duration (min)</label>
                            <input
                                type="text"
                                id={`${id}-duration`}
                                name="duration"
                                value={formData.duration}
                                onChange={handleChange}
                                placeholder="e.g., 30"
                                className="bg-[#121212] border-2 border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#AFFF00] focus:border-[#AFFF00] transition-colors"
                                required
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor={`${id}-intensity`} className="text-sm font-medium text-slate-400 mb-2">Intensity</label>
                            <select
                                id={`${id}-intensity`}
                                name="intensity"
                                value={formData.intensity}
                                onChange={handleChange}
                                className="w-full bg-[#121212] border-2 border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#AFFF00] focus:border-[#AFFF00] transition-colors appearance-none"
                            >
                                {Object.values(Intensity).map(level => <option key={level} value={level}>{level}</option>)}
                            </select>
                        </div>
                    </div>
                        <div className="flex flex-col">
                        <label htmlFor={`${id}-notes`} className="text-sm font-medium text-slate-400 mb-2">Notes (optional)</label>
                        <textarea
                            id={`${id}-notes`}
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="e.g., Felt strong today, new personal best!"
                            className="bg-[#121212] border-2 border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#AFFF00] focus:border-[#AFFF00] transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 bg-[#AFFF00] hover:bg-lime-400 text-black font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        <PlusCircle className="w-5 h-5" />
                        Log Activity
                    </button>
                </form>
            </div>
            <div className="bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-4">Recent Workouts</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {recentWorkouts.map(log => (
                        <div key={log.id} className="text-sm p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-slate-200">{log.type}</p>
                                <p className="text-xs text-slate-400">{log.date}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {log.duration} min</span>
                                <span className="flex items-center gap-1"><Zap className="w-3 h-3"/> {log.intensity}</span>
                            </div>
                            {log.notes && <p className="text-xs text-slate-300 mt-2 pt-2 border-t border-slate-700/50 flex items-start gap-2"><StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0"/> {log.notes}</p>}
                        </div>
                    ))}
                    {recentWorkouts.length === 0 && (
                        <p className="text-slate-400 text-center pt-10">No activities logged yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const CharacterSelection: React.FC<{ onSelect: (gender: CharacterGender) => void }> = ({ onSelect }) => {
    return (
        <div className="text-center p-10 bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl animate-fade-in">
            <User className="w-16 h-16 mx-auto text-[#AFFF00] mb-4" />
            <h2 className="text-2xl font-bold text-slate-200 mb-2">Choose Your Character</h2>
            <p className="text-slate-400 mb-8">Select an avatar to represent you on your fitness journey.</p>
            <div className="flex justify-center gap-8">
                <button onClick={() => onSelect(CharacterGender.MALE)} className="flex flex-col items-center gap-4 p-4 rounded-lg border-2 border-transparent hover:border-[#AFFF00] hover:bg-slate-800/50 transition-all">
                    <CharacterAvatar gender={CharacterGender.MALE} level={1} />
                    <span className="font-semibold text-slate-200">Male</span>
                </button>
                    <button onClick={() => onSelect(CharacterGender.FEMALE)} className="flex flex-col items-center gap-4 p-4 rounded-lg border-2 border-transparent hover:border-[#AFFF00] hover:bg-slate-800/50 transition-all">
                    <CharacterAvatar gender={CharacterGender.FEMALE} level={1} />
                    <span className="font-semibold text-slate-200">Female</span>
                </button>
            </div>
        </div>
    );
};

const ProgressDashboard: React.FC<{
  savedPlans: SavedPlan[];
  activityLog: ActivityLog[];
  onLogActivity: (activity: Omit<ActivityLog, 'id' | 'date'>) => void;
  onUpdatePlanCompletion: (planId: string, day: string) => void;
  onClearHistory: () => void;
  characterGender: CharacterGender | null;
  onSelectCharacter: (gender: CharacterGender) => void;
}> = ({ savedPlans, activityLog, onLogActivity, onUpdatePlanCompletion, onClearHistory, characterGender, onSelectCharacter }) => {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const { level, progress, activeDays, xpForNextLevel } = calculateLevel(activityLog);

  const togglePlan = (id: string) => {
    setExpandedPlanId(expandedPlanId === id ? null : id);
  };
  
  const handleClear = () => {
    if(window.confirm("Are you sure you want to delete all your saved plans and activity logs? This action cannot be undone.")) {
        onClearHistory();
    }
  }

  const handleMarkComplete = (planId: string, day: string) => {
    const plan = savedPlans.find(p => p.id === planId);
    if (!plan || plan.completionStatus[day]) return;

    onUpdatePlanCompletion(planId, day);
    
    const workoutName = plan.plan.workoutPlan[day]?.[0] || 'Planned Workout';
    onLogActivity({
        type: workoutName.split('(')[0].trim(),
        duration: 60, // Default duration
        intensity: Intensity.MEDIUM, // Default intensity
        notes: `Completed planned workout for ${day}.`
    });
  };

  const handleLogWater = (amount: number) => {
      onLogActivity({ type: 'Water Intake', amount });
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todaysWaterIntake = activityLog
    .filter(log => log.date === todayStr && log.type === 'Water Intake' && log.amount)
    .reduce((total, log) => total + log.amount!, 0);
  
  const waterGoal = savedPlans[0]?.plan.recommendedWaterIntake * 1000 || 3000; // Default 3000ml

  const sortedPlansByDate = [...savedPlans].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const sortedPlansForChart = [...savedPlans].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const chartData = {
    labels: sortedPlansForChart.map(p => p.date),
    datasets: [
      {
        label: 'Weight (kg)',
        data: sortedPlansForChart.map(p => p.userData.weight),
        borderColor: '#AFFF00',
        backgroundColor: 'rgba(175, 255, 0, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#AFFF00',
        pointBorderColor: '#121212',
        pointHoverRadius: 7,
        tension: 0.2,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Weight Progress Over Time',
        color: '#f1f5f9',
        font: {
            size: 18,
            weight: 'bold',
        }
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: {
            display: true,
            text: 'Weight (kg)',
            color: '#94a3b8'
        }
      },
    },
  };

  if (savedPlans.length === 0 && activityLog.length === 0) {
    return (
      <div className="text-center p-10 bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl">
        <h2 className="text-2xl font-bold text-slate-300">No Progress Saved Yet</h2>
        <p className="text-slate-400 mt-2">Go to the "Generator" tab to create your first plan and start tracking your journey!</p>
      </div>
    );
  }
  
  if (!characterGender) {
    return <CharacterSelection onSelect={onSelectCharacter} />
  }

  return (
    <div className="w-full animate-fade-in space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Progress Dashboard</h2>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors self-start sm:self-center"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Data
        </button>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                    <CharacterAvatar gender={characterGender} level={level} />
                </div>
                <div className="w-full">
                    <div className="flex justify-between items-baseline mb-2">
                        <h3 className="text-xl font-bold text-[#AFFF00]">Highlights</h3>
                        <span className="text-sm font-medium text-slate-400">Total Active Days: {activeDays}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-2xl text-slate-200">LVL {level}</span>
                        <div className="w-full bg-slate-700 rounded-full h-4">
                            <div className="bg-[#AFFF00] h-4 rounded-full transition-all duration-500" style={{width: `${(progress / xpForNextLevel) * 100}%`}}></div>
                        </div>
                    </div>
                    <p className="text-right text-xs text-slate-400 mt-1">{progress} / {xpForNextLevel} days to next level</p>
                </div>
            </div>
            <WaterTracker onLogWater={handleLogWater} dailyGoal={waterGoal} currentAmount={todaysWaterIntake} />
        </div>
      
      {savedPlans.length >= 2 && (
        <div className="bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl p-4 sm:p-6">
            <div style={{height: '300px'}}>
                <Line options={chartOptions} data={chartData} />
            </div>
        </div>
      )}

      <ActivityTracker onLogActivity={onLogActivity} activityLog={activityLog} />

      <div>
        <h3 className="text-xl font-bold text-slate-100 mb-4">Saved Plans History</h3>
        {savedPlans.length > 0 ? (
          <div className="space-y-4">
            {sortedPlansByDate.map((savedPlan) => (
              <div key={savedPlan.id} className="bg-[#1e1e1e]/50 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300">
                <button
                  onClick={() => togglePlan(savedPlan.id)}
                  className="w-full flex justify-between items-center p-4 sm:p-6 text-left"
                >
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300">
                        <span className="flex items-center gap-2 font-semibold text-lg text-slate-100"><Calendar className="w-5 h-5 text-[#AFFF00]" /> {savedPlan.date}</span>
                        <span className="flex items-center gap-2"><Weight className="w-4 h-4 text-slate-400" /> {savedPlan.userData.weight} kg</span>
                        <span className="flex items-center gap-2"><Target className="w-4 h-4 text-slate-400" /> {savedPlan.userData.goal}</span>
                    </div>
                    <ChevronDown className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${expandedPlanId === savedPlan.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedPlanId === savedPlan.id && (
                    <div className="px-2 sm:px-4 pb-4 animate-fade-in-down">
                        <div className="border-t border-slate-800 pt-4">
                            <PlanDisplay 
                                plan={savedPlan.plan} 
                                onBack={() => setExpandedPlanId(null)} 
                                backButtonText="Close Plan"
                                completionStatus={savedPlan.completionStatus}
                                onMarkComplete={(day) => handleMarkComplete(savedPlan.id, day)}
                            />
                        </div>
                    </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-slate-400">No plans saved yet.</p> }
      </div>
    </div>
  );
};

const NavButton: React.FC<{
    active: boolean,
    onClick: () => void,
    children: React.ReactNode
}> = ({ active, onClick, children }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            active 
            ? 'bg-[#AFFF00] text-black' 
            : 'text-slate-300 hover:bg-slate-700'
        }`}
    >
        {children}
    </button>
);

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  type View = 'generator' | 'progress';
  const [view, setView] = useState<View>('generator');
  const [fitnessPlan, setFitnessPlan] = useState<FitnessPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [characterGender, setCharacterGender] = useState<CharacterGender | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{ show: boolean, newLevel: number }>({ show: false, newLevel: 0 });

  useEffect(() => {
    try {
      const storedPlans = localStorage.getItem('fitnessPlans');
      if (storedPlans) setSavedPlans(JSON.parse(storedPlans));
      
      const storedActivities = localStorage.getItem('activityLog');
      if (storedActivities) setActivityLog(JSON.parse(storedActivities));

      const storedCharacter = localStorage.getItem('characterGender');
      if (storedCharacter) setCharacterGender(storedCharacter as CharacterGender);

    } catch (e) {
      console.error("Failed to parse saved data from localStorage", e);
      localStorage.clear(); // Clear all data on parsing error
    }
  }, []);

  const handleSelectCharacter = (gender: CharacterGender) => {
    setCharacterGender(gender);
    localStorage.setItem('characterGender', gender);
  };

  const handleGeneratePlan = async (data: UserData) => {
    setIsLoading(true);
    setError(null);
    setFitnessPlan(null);

    try {
      const plan = await generateFitnessPlan(data);
      setFitnessPlan(plan);

      const newSavedPlan: SavedPlan = {
        id: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-CA'),
        userData: data,
        plan: plan,
        completionStatus: {},
      };
      
      const updatedPlans = [newSavedPlan, ...savedPlans];
      setSavedPlans(updatedPlans);
      localStorage.setItem('fitnessPlans', JSON.stringify(updatedPlans));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setFitnessPlan(null);
    setError(null);
    setIsLoading(false);
    setView('generator');
  };
  
  const handleClearHistory = () => {
    if(window.confirm("Are you sure you want to delete all your saved plans, activity logs, and character? This action cannot be undone.")) {
        setSavedPlans([]);
        setActivityLog([]);
        setCharacterGender(null);
        localStorage.removeItem('fitnessPlans');
        localStorage.removeItem('activityLog');
        localStorage.removeItem('characterGender');
    }
  };

  const handleLogActivity = (activity: Omit<ActivityLog, 'id' | 'date'>) => {
    const { level: oldLevel } = calculateLevel(activityLog);
    
    const newActivity: ActivityLog = {
      ...activity,
      id: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-CA'),
    };
    
    const updatedLog = [newActivity, ...activityLog];
    
    const { level: newLevel } = calculateLevel(updatedLog);

    if (newLevel > oldLevel && newActivity.type !== 'Water Intake') {
        setLevelUpInfo({ show: true, newLevel });
    }
    
    setActivityLog(updatedLog);
    localStorage.setItem('activityLog', JSON.stringify(updatedLog));
  };
  
  const handleUpdatePlanCompletion = (planId: string, day: string) => {
    const updatedPlans = savedPlans.map(p => {
        if (p.id === planId) {
            return {
                ...p,
                completionStatus: {
                    ...p.completionStatus,
                    [day]: true
                }
            };
        }
        return p;
    });
    setSavedPlans(updatedPlans);
    localStorage.setItem('fitnessPlans', JSON.stringify(updatedPlans));
  };


  const renderGeneratorContent = () => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} onRetry={handleStartOver} />;
    if (fitnessPlan) return <PlanDisplay plan={fitnessPlan} onBack={handleStartOver} backButtonText="Create New Plan" />;
    return <UserInputForm onSubmit={handleGeneratePlan} isLoading={isLoading} />;
  };

  return (
    <div className="min-h-screen bg-[#121212] font-sans p-4 sm:p-6 lg:p-8 flex flex-col items-center">
       {levelUpInfo.show && characterGender && (
        <LevelUpModal
          level={levelUpInfo.newLevel}
          gender={characterGender}
          onClose={() => setLevelUpInfo({ show: false, newLevel: 0 })}
        />
      )}
      <div className="container mx-auto max-w-4xl w-full">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center justify-center gap-3 text-center">
            <Zap className="w-8 h-8 text-[#AFFF00]" />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
              Fitness and Diet Setter & Tracker
            </h1>
          </div>
          <nav className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg">
            <NavButton active={view === 'generator'} onClick={() => setView('generator')}>
                <Zap className="w-4 h-4" /> Generator
            </NavButton>
            <NavButton active={view === 'progress'} onClick={() => setView('progress')}>
                <History className="w-4 h-4" /> Progress
            </NavButton>
          </nav>
        </header>

        <main className="w-full">
          {view === 'generator' && renderGeneratorContent()}
          {view === 'progress' && (
            <ProgressDashboard 
                savedPlans={savedPlans} 
                activityLog={activityLog} 
                onLogActivity={handleLogActivity} 
                onUpdatePlanCompletion={handleUpdatePlanCompletion}
                onClearHistory={handleClearHistory}
                characterGender={characterGender}
                onSelectCharacter={handleSelectCharacter}
            />
          )}
        </main>

        <footer className="text-center mt-12 text-slate-600 text-xs">
          <p>Powered by the Gemini API. AI-generated plans are not a substitute for professional medical advice.</p>
        </footer>
      </div>
    </div>
  );
};


// --- RENDER APP ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
