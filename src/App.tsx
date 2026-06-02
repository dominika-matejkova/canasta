import { useState } from 'react';
import { Rules, AIDifficulty } from './engine/types';
import MainMenu from './components/MainMenu';
import GameBoard from './components/GameBoard';

type Screen = 'menu' | 'game';

interface GameConfig {
  rules: Rules;
  difficulty: AIDifficulty;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);

  const handleStart = (rules: Rules, difficulty: AIDifficulty) => {
    setConfig({ rules, difficulty });
    setScreen('game');
  };

  if (screen === 'game' && config) {
    return (
      <GameBoard
        key={JSON.stringify(config)}
        initialRules={config.rules}
        initialDifficulty={config.difficulty}
        onMenu={() => setScreen('menu')}
      />
    );
  }

  return <MainMenu onStart={handleStart} />;
}
