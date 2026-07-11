import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PointingBlackjackLayout } from "./pointing-blackjack/PointingBlackjackLayout";
import { PointingBlackjackLobby } from "./pointing-blackjack/PointingBlackjackLobby";
import { PointingBlackjackSession } from "./pointing-blackjack/PointingBlackjackSession";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PointingBlackjackLayout />}>
          <Route index element={<PointingBlackjackLobby />} />
          <Route path=":sessionId" element={<PointingBlackjackSession />} />
        </Route>
        <Route path="/pointing-showdown" element={<PointingBlackjackLayout />}>
          <Route index element={<PointingBlackjackLobby />} />
          <Route path=":sessionId" element={<PointingBlackjackSession />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
