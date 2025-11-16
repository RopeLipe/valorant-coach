import React, { useState } from 'react'
import { DesktopApp as NewDesktopApp } from '@code/components/desktop-app'
 

const DesktopApp: React.FC = () => {
  const [selectedCharacter, setSelectedCharacter] = useState<string>('')

  

  return <NewDesktopApp />
}

export default DesktopApp
