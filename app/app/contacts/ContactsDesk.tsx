          <div className="row">
            <button type="button" className={sourceFilter === "all" ? "kpi-dark chip" : "chip"} onClick={() => { setSourceFilter("all"); setPage(1); }}>All searches</button>
            {sources.map((name) => (
              <button key={name} type="button" className={sourceFilter === name ? "kpi-dark chip" : "chip"} onClick={() => { setSourceFilter(name); setPage(1); }}>{name}</button>
            ))}
          </div>
          <div className="row">
            <button type="button" className={reviewFilter === "all" ? "kpi-dark chip" : "chip"} onClick={() => { setReviewFilter("all"); setPage(1); }}>All</button>
            <button type="button" className={reviewFilter === "open" ? "kpi-dark chip" : "chip"} onClick={() => { setReviewFilter("open"); setPage(1); }}>Not reviewed</button>
            <button type="button" className={reviewFilter === "reviewed" ? "kpi-dark chip" : "chip"} onClick={() => { setReviewFilter("reviewed"); setPage(1); }}>Reviewed queue</button>
          </div>