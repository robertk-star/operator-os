        <div className="row">
          <label>
            Search source
            <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
              <option value="all">All searches</option>
              {sources.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <button type="button" onClick={createContact}>+ New company</button>
          <button type="button" className="chip" onClick={exportCsv}>Export CSV</button>
        </div>