5. Author every client parse of an API response against that endpoint's real return shape, not an assumed wrapper.
   Why: A wrong-shape mock passes CI while the live client mis-parses ids and raises false errors.
