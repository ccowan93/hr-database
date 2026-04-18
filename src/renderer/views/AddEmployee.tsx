import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Employee } from '../types/employee';
import EmployeeForm from '../components/EmployeeForm';

export default function AddEmployee() {
  const navigate = useNavigate();

  const handleSave = async (data: Partial<Employee>) => {
    const newId = await api.createEmployee(data);
    navigate(`/employees/${newId}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button onClick={() => navigate('/employees')} className="btn ghost" style={{ padding: '2px 0', marginBottom: 6 }}>
            ← Back to People
          </button>
          <h1 className="page-title">Add employee</h1>
          <p className="page-subtitle">Create a new employee record</p>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <EmployeeForm onSave={handleSave} onCancel={() => navigate('/employees')} />
        </div>
      </div>
    </div>
  );
}
