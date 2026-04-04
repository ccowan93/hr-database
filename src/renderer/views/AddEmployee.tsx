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
    <div>
      <button onClick={() => navigate('/employees')} className="text-sm text-blue-600 hover:underline mb-2 inline-block">
        &larr; Back to Employees
      </button>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Add New Employee</h2>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <EmployeeForm onSave={handleSave} onCancel={() => navigate('/employees')} />
      </div>
    </div>
  );
}
