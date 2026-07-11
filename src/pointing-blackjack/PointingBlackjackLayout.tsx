import React, { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  PointingBlackjackProvider,
  usePointingBlackjack,
} from "./PointingBlackjackProvider";
import { POINTY_TITLE, swapDocumentTitle } from "./documentTitle";
import { inLiveSession, lobbyPath } from "./paths";
import "./pointing-blackjack.scss";

const PointingBlackjackHeader: React.FC<{ showTagline: boolean }> = ({
  showTagline,
}) => {
  const { pathname } = useLocation();
  const { leaveTable } = usePointingBlackjack();
  return (
    <header className="pointing-blackjack__header">
      <h1 className="pointing-blackjack__title">Pointy</h1>
      {showTagline ? (
        <p className="pointing-blackjack__tagline">
          A FOSS sprint pointing tool —{" "}
          <a href="https://tyler.cloud">check out my other projects</a>;{" "}
          <a href="https://github.com/tylerjwoodfin/pointy.website">source</a>;{" "}
          <a href="https://venmo.com/tylerjwoodfin?txn=pay">buy me a chai latte</a>?
        </p>
      ) : null}
      {inLiveSession(pathname) ? (
        <Link
          className="pointing-blackjack__back"
          to={lobbyPath()}
          onClick={() => leaveTable()}
        >
          ← Lobby
        </Link>
      ) : null}
    </header>
  );
};

export const PointingBlackjackLayout: React.FC = () => {
  const { pathname } = useLocation();
  const showTagline = !inLiveSession(pathname);

  useEffect(() => {
    return swapDocumentTitle(POINTY_TITLE);
  }, []);

  return (
    <div className="pointing-blackjack">
      <PointingBlackjackProvider>
        <PointingBlackjackHeader showTagline={showTagline} />
        <main className="pointing-blackjack__main">
          <Outlet />
        </main>
      </PointingBlackjackProvider>
    </div>
  );
};
