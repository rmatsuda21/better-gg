import { useState } from 'react'
import { SearchBar } from './components/SearchBar/SearchBar'
import { TournamentList } from './components/TournamentList/TournamentList'
import styles from './App.module.css'

function App() {
  const [userId, setUserId] = useState('')

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>better.gg</h1>
        <p className={styles.subtitle}>
          Look up a player's recent tournaments on start.gg
        </p>
      </header>
      <SearchBar onSearch={setUserId} />
      {userId && <TournamentList userId={userId} />}
    </div>
  )
}

export default App
