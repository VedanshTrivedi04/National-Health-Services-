// src/contexts/DataContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import { useAuth } from './AuthContext';

const DataContext = createContext();
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [allDoctors, setAllDoctors] = useState(null); // cache of full list
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();

  // Fetch Departments
  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      let data = await apiService.getDepartments();
      if (data && data.results) data = data.results;
      if (!Array.isArray(data)) data = [];
      setDepartments(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setError('Failed to load departments');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Doctors (cached). If departmentId provided, returns filtered subset but does NOT drop allDoctors cache.
  const fetchDoctors = useCallback(
    async (departmentId = null) => {
      setIsLoading(true);
      try {
        let data = null;

        // If we already have cached allDoctors, use it
        if (allDoctors && Array.isArray(allDoctors)) {
          data = allDoctors;
        } else {
          // fetch all doctors once
          if (isAuthenticated) {
            data = await apiService.getDoctors(); // expected to return array or {results: [...]}
          } else {
            // public endpoint (fall back)
            data = await apiService.request('/doctor/');
          }

          if (data && data.results) data = data.results;
          if (!Array.isArray(data)) data = [];
          setAllDoctors(data);
        }

        // If departmentId requested, filter from cached/all list
        if (departmentId) {
          const filtered = data.filter((d) => {
            // backend sometimes provides department object or department_id
            const deptId = d?.department_id ?? d?.department?.id ?? null;
            return Number(deptId) === Number(departmentId);
          });
          // Do NOT overwrite the global cache, only set the visible doctors list
          setDoctors(filtered);
          return filtered;
        }

        // No department filter -> set full list
        setDoctors(data);
        return data;
      } catch (err) {
        console.error('Failed to fetch doctors:', err);
        setError('Failed to load doctors');
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [allDoctors, isAuthenticated]
  );

  // On mount fetch departments and doctors (non-blocking)
  useEffect(() => {
    fetchDepartments();
    // fetch doctors once and cache
    fetchDoctors();
  }, [fetchDepartments, fetchDoctors]);

  return (
    <DataContext.Provider
      value={{
        departments,
        doctors,
        isLoading,
        error,
        fetchDepartments,
        fetchDoctors,
        setError,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
