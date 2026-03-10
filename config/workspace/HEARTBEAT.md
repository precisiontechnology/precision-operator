# HEARTBEAT.md

## Daily Check-In

When heartbeat fires, do ONE pass:

1. Search for significant metric changes via Precision (MRR movement, churn spikes, goal misses)
2. If something notable → surface it to the user with data
3. If nothing notable → HEARTBEAT_OK

Do NOT:
- Ping the user if nothing changed
- Check more than once per day unless something is urgent
- Repeat alerts the user has already seen
